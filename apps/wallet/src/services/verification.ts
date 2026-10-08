import type { DocumentType, Presentation, PresentationState, VerificationSummary, WalletDocument } from "@dw/types";
import { api } from "./api";
import { keystore } from "./wallet";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "application/pdf"];

export const listDocuments = () => api.get<WalletDocument[]>("/documents");
export const deleteDocument = (id: string) => api.delete(`/documents/${id}`);
export const submitForVerification = (id: string) => api.post<VerificationSummary>(`/documents/${id}/verification`);

export interface NewDocument {
  file: Blob;
  type: DocumentType;
  documentNumber: string;
  name: string;
  description: string;
}

/** Uploads the scan and submits it to the issuer in one step. */
export async function addDocument(input: NewDocument): Promise<string> {
  const form = new FormData();
  form.set("file", input.file);
  form.set("type", input.type);
  form.set("documentNumber", input.documentNumber);
  form.set("name", input.name);
  if (input.description.trim()) form.set("description", input.description);
  const document = await api.upload<{ id: string }>("/documents", form);
  await submitForVerification(document.id);
  return document.id;
}

/** Opens a short-lived presentation session, proving possession of the wallet key. */
export async function createPresentation(credentialId: string): Promise<Presentation> {
  const timestamp = Date.now();
  const signature = await keystore.sign(`present:${credentialId}:${timestamp}`);
  return api.post<Presentation>("/presentations", { credentialId, timestamp, signature });
}

export const getPresentationState = (token: string) => api.get<PresentationState>(`/presentations/${token}`, false);
