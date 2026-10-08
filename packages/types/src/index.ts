// Shared contract between the API and the web/mobile clients.
// DOCUMENT_TYPES mirrors services/api/src/documents/document-types.ts.

export const DOCUMENT_TYPES = {
  NATIONAL_ID: { label: 'National ID', credentialType: 'NationalIDCredential' },
  UNIVERSITY_CERTIFICATE: { label: 'University Certificate', credentialType: 'UniversityCertificateCredential' },
  DRIVER_LICENSE: { label: 'Driver License', credentialType: 'DriverLicenseCredential' },
} as const;

export type DocumentType = keyof typeof DOCUMENT_TYPES;

export function documentTypeLabel(type: string): string {
  return DOCUMENT_TYPES[type as DocumentType]?.label ?? type;
}

export function credentialTypeLabel(credentialType: string): string {
  return Object.values(DOCUMENT_TYPES).find((t) => t.credentialType === credentialType)?.label ?? credentialType;
}

export type DocumentStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED' | 'REVOKED';
export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type CredentialStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED';

export interface SessionUser {
  id: string;
  email: string | null;
  phone: string | null;
  role: 'holder' | 'issuer';
  issuerId: string | null;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}

export interface Wallet {
  id: string;
  publicKey: string;
  status: string;
}

export interface VerificationSummary {
  id: string;
  status: RequestStatus;
  submittedAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
  issuerName: string;
}

export interface WalletDocument {
  id: string;
  type: DocumentType;
  status: DocumentStatus;
  metadata: { name: string; documentNumber: string; description?: string; mimeType: string };
  createdAt: string;
  verification: VerificationSummary | null;
  credentialId: string | null;
}

export interface Credential {
  id: string;
  documentId: string | null;
  type: string;
  issuer: { id: string; name: string; identifier: string };
  subject: { fullName: string; documentNumber: string };
  issuedAt: string;
  expiresAt: string;
  revokedAt: string | null;
  status: CredentialStatus;
  jws: string;
}

export interface IssuerRequest {
  id: string;
  status: RequestStatus;
  submittedAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
  applicantName: string;
  document: {
    id: string;
    type: DocumentType;
    documentNumber: string;
    description: string | null;
    mimeType: string;
    walletId: string;
  };
}

export interface AuditLogEntry {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  actor: string | null;
  createdAt: string;
}

export interface Presentation {
  token: string;
  expiresAt: string;
  verifyUrl: string;
}

export interface PresentationState {
  status: 'PENDING' | 'VERIFIED' | 'EXPIRED';
  result: 'VALID' | 'INVALID' | null;
  expiresAt: string;
}

export type CheckName = 'signature' | 'issuer' | 'expiration' | 'revocation' | 'presentation';

export interface VerificationResult {
  valid: boolean;
  reason: string | null;
  checks: { name: CheckName; passed: boolean }[];
  credential?: { documentType: string; name: string; issuer: string; issuedAt: string; expiresAt: string };
}
