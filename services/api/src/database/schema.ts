import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

const id = () => uuid().primaryKey().defaultRandom();
const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp({ withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date());

export type DocumentStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED' | 'REVOKED';
export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type CredentialStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED';
export type UserRole = 'holder' | 'issuer';

export interface DocumentMetadata {
  name: string;
  documentNumber: string;
  description?: string;
  mimeType: string;
}

export const issuers = pgTable('issuers', {
  id: id(),
  name: text().notNull(),
  type: text().notNull(),
  identifier: text().notNull().unique(),
  // Public JWK only. Private signing keys never live in database rows.
  publicKey: text().notNull(),
  status: text().notNull().default('active'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const users = pgTable('users', {
  id: id(),
  email: text().unique(),
  phone: text().unique(),
  passwordHash: text().notNull(),
  role: text().$type<UserRole>().notNull().default('holder'),
  issuerId: uuid().references(() => issuers.id),
  status: text().notNull().default('active'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const refreshTokens = pgTable('refresh_tokens', {
  id: id(),
  userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text().notNull().unique(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  revokedAt: timestamp({ withTimezone: true }),
  createdAt: createdAt(),
});

export const wallets = pgTable('wallets', {
  id: id(),
  userId: uuid().notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  // base64url raw Ed25519 public key generated on the holder's device
  publicKey: text().notNull(),
  keyReference: text().notNull().default('device'),
  status: text().notNull().default('active'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const documents = pgTable('documents', {
  id: id(),
  walletId: uuid().notNull().references(() => wallets.id, { onDelete: 'cascade' }),
  type: text().notNull(),
  fileUrl: text().notNull(),
  metadata: jsonb().$type<DocumentMetadata>().notNull(),
  status: text().$type<DocumentStatus>().notNull().default('PENDING'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const verificationRequests = pgTable('verification_requests', {
  id: id(),
  documentId: uuid().notNull().references(() => documents.id, { onDelete: 'cascade' }),
  issuerId: uuid().notNull().references(() => issuers.id),
  status: text().$type<RequestStatus>().notNull().default('PENDING'),
  submittedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp({ withTimezone: true }),
  reviewedBy: uuid().references(() => users.id),
  rejectionReason: text(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const credentials = pgTable('credentials', {
  id: id(),
  documentId: uuid().references(() => documents.id, { onDelete: 'set null' }),
  issuerId: uuid().notNull().references(() => issuers.id),
  holderId: uuid().notNull().references(() => wallets.id, { onDelete: 'cascade' }),
  type: text().notNull(),
  credentialData: jsonb().$type<Record<string, unknown>>().notNull(),
  // Compact JWS (EdDSA) over credentialData, produced with the issuer key
  signature: text().notNull(),
  issuedAt: timestamp({ withTimezone: true }).notNull(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  status: text().$type<CredentialStatus>().notNull().default('ACTIVE'),
  revokedAt: timestamp({ withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const verificationSessions = pgTable('verification_sessions', {
  id: id(),
  credentialId: uuid().notNull().references(() => credentials.id, { onDelete: 'cascade' }),
  nonce: text().notNull(),
  tokenHash: text().notNull().unique(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  verifiedAt: timestamp({ withTimezone: true }),
  result: text().$type<'VALID' | 'INVALID'>(),
  createdAt: createdAt(),
});

export const auditLogs = pgTable('audit_logs', {
  id: id(),
  actorId: uuid(),
  actorType: text().notNull(),
  action: text().notNull(),
  resourceType: text().notNull(),
  resourceId: uuid(),
  metadata: jsonb().$type<Record<string, unknown>>(),
  createdAt: createdAt(),
});
