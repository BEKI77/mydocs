import {
  BadRequestException, Body, ConflictException, Controller, Delete, ForbiddenException, Get, HttpCode,
  Inject, NotFoundException, Param, ParseUUIDPipe, Post, Res, StreamableFile, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Response } from 'express';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import { AuthUser, CurrentUser } from '../common/auth';
import { ZodPipe } from '../common/zod.pipe';
import { config } from '../config';
import { DB, Db } from '../database/db';
import { credentials, documents, issuers, verificationRequests, wallets } from '../database/schema';
import { StorageService } from '../storage/storage.service';
import { WalletsService } from '../wallets/wallets.service';
import { DOCUMENT_TYPE_CODES } from './document-types';

const createSchema = z.object({
  type: z.enum(DOCUMENT_TYPE_CODES),
  documentNumber: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
});
const submitSchema = z.object({ issuerId: z.uuid().optional() });

@Controller('documents')
export class DocumentsController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly walletsService: WalletsService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: config.maxUploadBytes, files: 1 } }))
  async create(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body(new ZodPipe(createSchema)) body: z.infer<typeof createSchema>,
  ) {
    if (!file) throw new BadRequestException('A document file is required');
    const wallet = await this.walletsService.require(user.id);
    const { mime, ext } = this.storage.detectType(file.buffer);
    const fileUrl = await this.storage.save(file.buffer, ext);
    const [document] = await this.db
      .insert(documents)
      .values({
        walletId: wallet.id,
        type: body.type,
        fileUrl,
        metadata: { name: body.name, documentNumber: body.documentNumber, description: body.description, mimeType: mime },
      })
      .returning();
    await this.audit.log({ actorId: user.id, actorType: 'holder', action: 'document.uploaded', resourceType: 'document', resourceId: document.id });
    return this.view(document);
  }

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const wallet = await this.walletsService.require(user.id);
    const rows = await this.db.select().from(documents).where(eq(documents.walletId, wallet.id)).orderBy(desc(documents.createdAt));
    if (rows.length === 0) return [];
    const ids = rows.map((d) => d.id);
    const requests = await this.db
      .select({ request: verificationRequests, issuerName: issuers.name })
      .from(verificationRequests)
      .innerJoin(issuers, eq(verificationRequests.issuerId, issuers.id))
      .where(inArray(verificationRequests.documentId, ids))
      .orderBy(desc(verificationRequests.submittedAt));
    const creds = await this.db.select({ id: credentials.id, documentId: credentials.documentId }).from(credentials).where(inArray(credentials.documentId, ids));
    return rows.map((document) => {
      const latest = requests.find((r) => r.request.documentId === document.id);
      return {
        ...this.view(document),
        verification: latest ? this.requestView(latest.request, latest.issuerName) : null,
        credentialId: creds.find((c) => c.documentId === document.id)?.id ?? null,
      };
    });
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.view(await this.owned(user, id));
  }

  /** Streams the private scan to its owner or to staff of an issuer it was submitted to. */
  @Get(':id/file')
  async file(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Res({ passthrough: true }) res: Response) {
    const [document] = await this.db.select().from(documents).where(eq(documents.id, id));
    if (!document) throw new NotFoundException('Document not found');
    if (user.role === 'issuer') {
      const [request] = await this.db.select({ id: verificationRequests.id }).from(verificationRequests)
        .where(and(eq(verificationRequests.documentId, id), eq(verificationRequests.issuerId, user.issuerId!)));
      if (!request) throw new ForbiddenException();
    } else {
      await this.owned(user, id);
    }
    res.set({ 'Content-Type': document.metadata.mimeType, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
    return new StreamableFile(this.storage.open(document.fileUrl));
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    const document = await this.owned(user, id);
    if (document.status === 'VERIFIED') throw new ConflictException('A verified document cannot be deleted');
    await this.db.delete(documents).where(eq(documents.id, id));
    await this.storage.remove(document.fileUrl);
    await this.audit.log({ actorId: user.id, actorType: 'holder', action: 'document.deleted', resourceType: 'document', resourceId: id });
  }

  @Post(':id/verification')
  async submit(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(submitSchema)) body: z.infer<typeof submitSchema>,
  ) {
    const document = await this.owned(user, id);
    const existing = await this.db.select().from(verificationRequests).where(eq(verificationRequests.documentId, id));
    if (existing.some((r) => r.status !== 'REJECTED')) throw new ConflictException('This document has already been submitted');

    // MVP has a single mock issuer, so default to the first active one.
    const [issuer] = await this.db.select().from(issuers)
      .where(body.issuerId ? and(eq(issuers.id, body.issuerId), eq(issuers.status, 'active')) : eq(issuers.status, 'active'))
      .orderBy(issuers.createdAt).limit(1);
    if (!issuer) throw new BadRequestException('No issuer is available to verify this document');

    const [request] = await this.db.transaction(async (tx) => {
      await tx.update(documents).set({ status: 'PENDING' }).where(eq(documents.id, id));
      return tx.insert(verificationRequests).values({ documentId: document.id, issuerId: issuer.id }).returning();
    });
    await this.audit.log({ actorId: user.id, actorType: 'holder', action: 'verification.submitted', resourceType: 'verification_request', resourceId: request.id });
    return this.requestView(request, issuer.name);
  }

  @Get(':id/verification')
  async verification(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.owned(user, id);
    const [row] = await this.db
      .select({ request: verificationRequests, issuerName: issuers.name })
      .from(verificationRequests)
      .innerJoin(issuers, eq(verificationRequests.issuerId, issuers.id))
      .where(eq(verificationRequests.documentId, id))
      .orderBy(desc(verificationRequests.submittedAt))
      .limit(1);
    if (!row) throw new NotFoundException('This document has not been submitted for verification');
    return this.requestView(row.request, row.issuerName);
  }

  private async owned(user: AuthUser, id: string) {
    const [row] = await this.db
      .select({ document: documents })
      .from(documents)
      .innerJoin(wallets, eq(documents.walletId, wallets.id))
      .where(and(eq(documents.id, id), eq(wallets.userId, user.id)));
    if (!row) throw new NotFoundException('Document not found');
    return row.document;
  }

  private view(document: typeof documents.$inferSelect) {
    const { id, type, status, metadata, createdAt } = document;
    return { id, type, status, metadata, createdAt };
  }

  private requestView(request: typeof verificationRequests.$inferSelect, issuerName: string) {
    const { id, status, submittedAt, reviewedAt, rejectionReason } = request;
    return { id, status, submittedAt, reviewedAt, rejectionReason, issuerName };
  }
}
