import {
  BadRequestException, Body, ConflictException, Controller, Get, HttpCode, Inject, NotFoundException,
  Param, ParseUUIDPipe, Post, Query,
} from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import { AuthUser, CurrentUser, Roles } from '../common/auth';
import { ZodPipe } from '../common/zod.pipe';
import { config } from '../config';
import { CredentialsService } from '../credentials/credentials.service';
import { DB, Db } from '../database/db';
import { auditLogs, documents, issuers, RequestStatus, users, verificationRequests } from '../database/schema';

const listSchema = z.object({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional() });
const approveSchema = z.object({ expiresAt: z.coerce.date().optional() });
const rejectSchema = z.object({ reason: z.string().trim().min(3).max(500) });

@Roles('issuer')
@Controller('issuer')
export class IssuerController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly credentialsService: CredentialsService,
    private readonly audit: AuditService,
  ) {}

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    const [issuer] = await this.db.select().from(issuers).where(eq(issuers.id, user.issuerId!));
    return { id: issuer.id, name: issuer.name, type: issuer.type, identifier: issuer.identifier };
  }

  @Get('verification-requests')
  async list(@CurrentUser() user: AuthUser, @Query(new ZodPipe(listSchema)) query: z.infer<typeof listSchema>) {
    const rows = await this.db
      .select({ request: verificationRequests, document: documents })
      .from(verificationRequests)
      .innerJoin(documents, eq(verificationRequests.documentId, documents.id))
      .where(and(
        eq(verificationRequests.issuerId, user.issuerId!),
        query.status ? eq(verificationRequests.status, query.status as RequestStatus) : undefined,
      ))
      .orderBy(desc(verificationRequests.submittedAt));
    return rows.map((row) => this.view(row.request, row.document));
  }

  @Get('verification-requests/:id')
  async get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    const { request, document } = await this.find(user, id);
    return this.view(request, document);
  }

  /** Approve: mark the request, create and sign the credential — all or nothing. */
  @Post('verification-requests/:id/approve')
  @HttpCode(200)
  async approve(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(approveSchema)) body: z.infer<typeof approveSchema>,
  ) {
    const { document } = await this.find(user, id);
    const expiresAt = body.expiresAt ?? new Date(Date.now() + config.credentialValidityYears * 365 * 86_400_000);
    if (expiresAt <= new Date()) throw new BadRequestException('Expiry date must be in the future');
    const [issuer] = await this.db.select().from(issuers).where(eq(issuers.id, user.issuerId!));

    const credential = await this.db.transaction(async (tx) => {
      // The status condition makes a concurrent second approval a no-op.
      const [request] = await tx
        .update(verificationRequests)
        .set({ status: 'APPROVED', reviewedAt: new Date(), reviewedBy: user.id })
        .where(and(eq(verificationRequests.id, id), eq(verificationRequests.status, 'PENDING')))
        .returning();
      if (!request) throw new ConflictException('This request has already been reviewed');
      await tx.update(documents).set({ status: 'VERIFIED' }).where(eq(documents.id, document.id));
      const issued = await this.credentialsService.issue(tx, { document, issuer, expiresAt });
      await this.audit.log(
        { actorId: user.id, actorType: 'issuer', action: 'verification.approved', resourceType: 'credential', resourceId: issued.id, metadata: { requestId: id } },
        tx,
      );
      return issued;
    });
    return this.credentialsService.view(credential, issuer);
  }

  @Post('verification-requests/:id/reject')
  @HttpCode(200)
  async reject(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(rejectSchema)) body: z.infer<typeof rejectSchema>,
  ) {
    const { document } = await this.find(user, id);
    const request = await this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(verificationRequests)
        .set({ status: 'REJECTED', reviewedAt: new Date(), reviewedBy: user.id, rejectionReason: body.reason })
        .where(and(eq(verificationRequests.id, id), eq(verificationRequests.status, 'PENDING')))
        .returning();
      if (!updated) throw new ConflictException('This request has already been reviewed');
      await tx.update(documents).set({ status: 'REJECTED' }).where(eq(documents.id, document.id));
      await this.audit.log(
        { actorId: user.id, actorType: 'issuer', action: 'verification.rejected', resourceType: 'verification_request', resourceId: id },
        tx,
      );
      return updated;
    });
    return this.view(request, { ...document, status: 'REJECTED' });
  }

  @Get('credentials')
  credentials(@CurrentUser() user: AuthUser) {
    return this.credentialsService.listForIssuer(user.issuerId!);
  }

  /** Actions taken by this issuer's staff, newest first. */
  @Get('audit-logs')
  async auditLog(@CurrentUser() user: AuthUser) {
    const rows = await this.db
      .select({ log: auditLogs, email: users.email })
      .from(auditLogs)
      .innerJoin(users, eq(auditLogs.actorId, users.id))
      .where(and(eq(auditLogs.actorType, 'issuer'), eq(users.issuerId, user.issuerId!)))
      .orderBy(desc(auditLogs.createdAt))
      .limit(50);
    return rows.map(({ log, email }) => ({
      id: log.id, action: log.action, resourceType: log.resourceType, resourceId: log.resourceId, actor: email, createdAt: log.createdAt,
    }));
  }

  private async find(user: AuthUser, id: string) {
    const [row] = await this.db
      .select({ request: verificationRequests, document: documents })
      .from(verificationRequests)
      .innerJoin(documents, eq(verificationRequests.documentId, documents.id))
      .where(and(eq(verificationRequests.id, id), eq(verificationRequests.issuerId, user.issuerId!)));
    if (!row) throw new NotFoundException('Verification request not found');
    return row;
  }

  private view(request: typeof verificationRequests.$inferSelect, document: typeof documents.$inferSelect) {
    return {
      id: request.id,
      status: request.status,
      submittedAt: request.submittedAt,
      reviewedAt: request.reviewedAt,
      rejectionReason: request.rejectionReason,
      applicantName: document.metadata.name,
      document: {
        id: document.id,
        type: document.type,
        documentNumber: document.metadata.documentNumber,
        description: document.metadata.description ?? null,
        mimeType: document.metadata.mimeType,
        walletId: document.walletId,
      },
    };
  }
}
