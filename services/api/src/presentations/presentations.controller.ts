import {
  BadRequestException, Body, Controller, ForbiddenException, Get, HttpCode, Inject, NotFoundException, Param, Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { and, eq, isNull } from 'drizzle-orm';
import { createPublicKey, randomBytes, verify } from 'node:crypto';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import { sha256 } from '../auth/auth.service';
import { AuthUser, CurrentUser, Public, Roles } from '../common/auth';
import { ZodPipe } from '../common/zod.pipe';
import { config } from '../config';
import { CredentialsService } from '../credentials/credentials.service';
import { DB, Db } from '../database/db';
import { verificationSessions } from '../database/schema';
import { DOCUMENT_TYPES } from '../documents/document-types';

const createSchema = z.object({
  credentialId: z.uuid(),
  // Unix ms when the wallet signed; bounds how long a captured request stays usable.
  timestamp: z.number().int(),
  // base64url Ed25519 signature over `present:<credentialId>:<timestamp>` by the wallet key
  signature: z.string().regex(/^[A-Za-z0-9_-]{86}$/),
});
const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const PROOF_MAX_AGE_MS = 60_000;

const FAILURE_REASONS: Record<string, string> = {
  signature: 'The credential signature is not valid.',
  issuer: 'The issuer is not trusted.',
  expiration: 'Credential has expired.',
  revocation: 'Credential has been revoked.',
  presentation: 'This presentation code has expired or was already used.',
};

@Controller('presentations')
export class PresentationsController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly credentialsService: CredentialsService,
    private readonly audit: AuditService,
  ) {}

  /** Holder opens a short-lived, single-use session; only its opaque token goes into the QR. */
  @Post()
  @Roles('holder')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(createSchema)) body: z.infer<typeof createSchema>) {
    const { credential, wallet } = await this.credentialsService.findWithIssuer(body.credentialId);
    if (wallet.userId !== user.id) throw new ForbiddenException();
    if (Math.abs(Date.now() - body.timestamp) > PROOF_MAX_AGE_MS) throw new BadRequestException('Presentation proof is stale');

    // Proof of possession: only the device holding the wallet's private key can present.
    const key = createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: wallet.publicKey }, format: 'jwk' });
    const message = Buffer.from(`present:${body.credentialId}:${body.timestamp}`);
    if (!verify(null, message, key, Buffer.from(body.signature, 'base64url'))) {
      throw new ForbiddenException('Wallet signature is not valid');
    }

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + config.presentationTtlSeconds * 1000);
    await this.db.insert(verificationSessions).values({
      credentialId: credential.id,
      nonce: randomBytes(16).toString('base64url'),
      tokenHash: sha256(token),
      expiresAt,
    });
    await this.audit.log({ actorId: user.id, actorType: 'holder', action: 'presentation.created', resourceType: 'credential', resourceId: credential.id });
    return { token, expiresAt, verifyUrl: `${config.verifyBaseUrl}/${token}` };
  }

  /** Session state only — no credential data. The wallet polls this while showing the QR. */
  @Get(':token')
  @Public()
  async state(@Param('token', new ZodPipe(tokenSchema)) token: string) {
    const session = await this.session(token);
    const status = session.verifiedAt ? 'VERIFIED' : session.expiresAt <= new Date() ? 'EXPIRED' : 'PENDING';
    return { status, result: session.result, expiresAt: session.expiresAt };
  }

  /** Verifier redeems the token. Validity is decided here, never by a client. */
  @Post(':token/verify')
  @Public()
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async verify(@Param('token', new ZodPipe(tokenSchema)) token: string) {
    const session = await this.session(token);
    // Claiming the session atomically is what makes the token single-use.
    const [claimed] = await this.db
      .update(verificationSessions)
      .set({ verifiedAt: new Date() })
      .where(and(eq(verificationSessions.id, session.id), isNull(verificationSessions.verifiedAt)))
      .returning();
    const presentationValid = Boolean(claimed) && session.expiresAt > new Date();

    const { credential, issuer } = await this.credentialsService.findWithIssuer(session.credentialId);
    const checks = [
      ...(await this.credentialsService.verify(credential, issuer)),
      { name: 'presentation' as const, passed: presentationValid },
    ];
    const failed = checks.find((check) => !check.passed);
    const valid = !failed;

    if (claimed) {
      await this.db.update(verificationSessions).set({ result: valid ? 'VALID' : 'INVALID' }).where(eq(verificationSessions.id, session.id));
    }
    await this.audit.log({
      actorType: 'verifier',
      action: valid ? 'presentation.verified' : 'presentation.rejected',
      resourceType: 'credential',
      resourceId: credential.id,
      metadata: { failedCheck: failed?.name ?? null },
    });

    if (!presentationValid) return { valid: false, reason: FAILURE_REASONS.presentation, checks: [] };
    // Only the minimum a verifier needs: no scan, no document number, no internal IDs.
    const view = this.credentialsService.view(credential, issuer);
    const documentType = Object.values(DOCUMENT_TYPES).find((t) => t.credentialType === credential.type)?.label ?? credential.type;
    return {
      valid,
      reason: failed ? FAILURE_REASONS[failed.name] : null,
      checks,
      credential: {
        documentType,
        name: view.subject.fullName,
        issuer: issuer.name,
        issuedAt: credential.issuedAt,
        expiresAt: credential.expiresAt,
      },
    };
  }

  private async session(token: string) {
    const [session] = await this.db.select().from(verificationSessions).where(eq(verificationSessions.tokenHash, sha256(token)));
    if (!session) throw new NotFoundException('Presentation not found');
    return session;
  }
}
