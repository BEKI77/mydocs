import type { Credential } from "@dw/types";
import { api } from "./api";
import { keystore } from "./wallet";

export interface CredentialList {
  credentials: Credential[];
  /** True when the server was unreachable and this is the encrypted on-device copy. */
  offline: boolean;
}

/** Fetches credentials and refreshes the encrypted local copy; falls back to it when offline. */
export async function listCredentials(): Promise<CredentialList> {
  try {
    const credentials = await api.get<Credential[]>("/wallet/credentials");
    await keystore.saveVault(JSON.stringify(credentials)).catch(() => {});
    return { credentials, offline: false };
  } catch (error) {
    const cached = await keystore.loadVault().catch(() => null);
    if (cached) return { credentials: JSON.parse(cached), offline: true };
    throw error;
  }
}

export const getCredential = (id: string) => api.get<Credential>(`/credentials/${id}`);

export const maskNumber = (value: string) => "•".repeat(Math.max(value.length - 3, 3)) + value.slice(-3);

export const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

/** Expiry is an end-of-day UTC instant; showing it in UTC keeps the date the issuer chose. */
export const formatExpiry = (value: string) =>
  new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
