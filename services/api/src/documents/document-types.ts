// Keep in sync with packages/types/src/index.ts (frontends import that copy).
export const DOCUMENT_TYPES = {
  NATIONAL_ID: { label: 'National ID', credentialType: 'NationalIDCredential' },
  UNIVERSITY_CERTIFICATE: { label: 'University Certificate', credentialType: 'UniversityCertificateCredential' },
  DRIVER_LICENSE: { label: 'Driver License', credentialType: 'DriverLicenseCredential' },
} as const;

export type DocumentType = keyof typeof DOCUMENT_TYPES;
export const DOCUMENT_TYPE_CODES = Object.keys(DOCUMENT_TYPES) as [DocumentType, ...DocumentType[]];
