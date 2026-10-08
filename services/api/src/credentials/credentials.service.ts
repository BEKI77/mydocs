import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { compactVerify, SignJWT } from 'jose';
import { randomUUID } from 'node:crypto';
import { DB, Db } from '../database/db';
import { credentials, CredentialStatus, documents, issuers, wallets } from '../database/schema';
import { DOCUMENT_TYPES, DocumentType } from '../documents/document-types';
import { IssuerKeysService, SIGNING_ALG } from '../issuers/issuer-keys.service';

type Credential = typeof credentials.$inferSelect;
type Issuer = typeof issuers.$inferSelect;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export interface CredentialCheck {
  name: 'signature' | 'issuer' | 'expiration' | 'revocation';
  passed: boolean;
}

@Injectable()
export class CredentialsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly keys: IssuerKeysService,
  ) {}

  /** Stored status plus expiry, which is derived from time rather than written by a job. */
  effectiveStatus(credential: Pick<Credential, 'status' | 'expiresAt'>): CredentialStatus {
    if (credential.status === 'REVOKED') return 'REVOKED';
    return credential.expiresAt <= new Date() ? 'EXPIRED' : 'ACTIVE';
  }

  /** Builds a VC-JWT style credential and signs it with the issuer's Ed25519 key. */
  async issue(
    tx: Tx,
    input: {
      document: typeof documents.$inferSelect;
      issuer: Issuer;
      expiresAt: Date;
    },
  ): Promise<Credential> {
    const { document, issuer, expiresAt } = input;
    const id = randomUUID();
    const issuedAt = new Date();
    const type = DOCUMENT_TYPES[document.type as DocumentType].credentialType;
    const payload = {
      jti: id,
      iss: `issuer:${issuer.identifier}`,
      sub: `wallet:${document.walletId}`,
      iat: Math.floor(issuedAt.getTime() / 1000),
      nbf: Math.floor(issuedAt.getTime() / 1000),
      exp: Math.floor(expiresAt.getTime() / 1000),
      vc: {
        type: ['VerifiableCredential', type],
        credentialSubject: {
          fullName: document.metadata.name,
          documentNumber: document.metadata.documentNumber,
        },
      },
    };
    const signature = await new SignJWT(payload)
      .setProtectedHeader({ alg: SIGNING_ALG, typ: 'vc+jwt', kid: issuer.identifier })
      .sign(await this.keys.privateKey(issuer.identifier));

    const [credential] = await tx
      .insert(credentials)
      .values({
        id,
        documentId: document.id,
        issuerId: issuer.id,
        holderId: document.walletId,
        type,
        credentialData: payload,
        signature,
        issuedAt,
        expiresAt,
      })
      .returning();
    return credential;
  }

  /**
   * Server-side verification. The signed payload, not the database row, is the
   * source of truth for what the issuer attested.
   */
  async verify(credential: Credential, issuer: Issuer): Promise<CredentialCheck[]> {
    let signatureValid = false;
    try {
      const { payload } = await compactVerify(credential.signature, await this.keys.publicKey(issuer.publicKey), {
        algorithms: [SIGNING_ALG],
      });
      const claims = JSON.parse(new TextDecoder().decode(payload));
      signatureValid =
        claims.jti === credential.id &&
        claims.iss === `issuer:${issuer.identifier}` &&
        claims.sub === `wallet:${credential.holderId}` &&
        claims.exp === Math.floor(credential.expiresAt.getTime() / 1000);
    } catch {
      signatureValid = false;
    }
    const status = this.effectiveStatus(credential);
    return [
      { name: 'signature', passed: signatureValid },
      { name: 'issuer', passed: issuer.status === 'active' },
      { name: 'expiration', passed: credential.expiresAt > new Date() },
      { name: 'revocation', passed: status !== 'REVOKED' },
    ];
  }

  async findWithIssuer(id: string) {
    const [row] = await this.db
      .select({ credential: credentials, issuer: issuers, wallet: wallets })
      .from(credentials)
      .innerJoin(issuers, eq(credentials.issuerId, issuers.id))
      .innerJoin(wallets, eq(credentials.holderId, wallets.id))
      .where(eq(credentials.id, id));
    if (!row) throw new NotFoundException('Credential not found');
    return row;
  }

  async listForHolder(walletId: string) {
    const rows = await this.db
      .select({ credential: credentials, issuer: issuers })
      .from(credentials)
      .innerJoin(issuers, eq(credentials.issuerId, issuers.id))
      .where(eq(credentials.holderId, walletId))
      .orderBy(desc(credentials.issuedAt));
    return rows.map((row) => this.view(row.credential, row.issuer));
  }

  async listForIssuer(issuerId: string) {
    const rows = await this.db
      .select({ credential: credentials, issuer: issuers })
      .from(credentials)
      .innerJoin(issuers, eq(credentials.issuerId, issuers.id))
      .where(eq(credentials.issuerId, issuerId))
      .orderBy(desc(credentials.issuedAt));
    return rows.map((row) => this.view(row.credential, row.issuer));
  }

  view(credential: Credential, issuer: Issuer) {
    const subject = (credential.credentialData as any).vc.credentialSubject as {
      fullName: string;
      documentNumber: string;
    };
    return {
      id: credential.id,
      documentId: credential.documentId,
      type: credential.type,
      issuer: { id: issuer.id, name: issuer.name, identifier: issuer.identifier },
      subject,
      issuedAt: credential.issuedAt,
      expiresAt: credential.expiresAt,
      revokedAt: credential.revokedAt,
      status: this.effectiveStatus(credential),
      jws: credential.signature,
    };
  }
}
