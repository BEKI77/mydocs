import { Controller, ForbiddenException, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service';
import { AuthUser, CurrentUser, Roles } from '../common/auth';
import { DB, Db } from '../database/db';
import { credentials, documents } from '../database/schema';
import { CredentialsService } from './credentials.service';

@Controller('credentials')
export class CredentialsController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly credentialsService: CredentialsService,
    private readonly audit: AuditService,
  ) {}

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    const row = await this.authorized(user, id);
    return this.credentialsService.view(row.credential, row.issuer);
  }

  @Get(':id/status')
  async status(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    const { credential } = await this.authorized(user, id);
    return { id, status: this.credentialsService.effectiveStatus(credential), expiresAt: credential.expiresAt };
  }

  @Post(':id/revoke')
  @Roles('issuer')
  @HttpCode(200)
  async revoke(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    const { credential, issuer } = await this.authorized(user, id);
    if (credential.status === 'REVOKED') return this.credentialsService.view(credential, issuer);

    const revoked = await this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(credentials)
        .set({ status: 'REVOKED', revokedAt: new Date() })
        .where(eq(credentials.id, id))
        .returning();
      if (credential.documentId) {
        await tx.update(documents).set({ status: 'REVOKED' }).where(eq(documents.id, credential.documentId));
      }
      await this.audit.log(
        { actorId: user.id, actorType: 'issuer', action: 'credential.revoked', resourceType: 'credential', resourceId: id },
        tx,
      );
      return updated;
    });
    return this.credentialsService.view(revoked, issuer);
  }

  /** Holders may read their own credentials; issuer staff only those their issuer signed. */
  private async authorized(user: AuthUser, id: string) {
    const row = await this.credentialsService.findWithIssuer(id);
    const allowed =
      user.role === 'issuer' ? row.credential.issuerId === user.issuerId : row.wallet.userId === user.id;
    if (!allowed) throw new ForbiddenException();
    return row;
  }
}
