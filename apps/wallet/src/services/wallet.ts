import { invoke, isTauri } from "@tauri-apps/api/core";

/**
 * The wallet's signing key. In the app, the key lives in Rust (src-tauri/src/wallet.rs)
 * and never reaches JavaScript. The browser implementation below exists only so the UI
 * can be developed with `pnpm dev`; it is not used in the packaged app.
 */
export interface Keystore {
  exists(account: string): Promise<boolean>;
  create(account: string, password: string): Promise<string>;
  unlock(account: string, password: string): Promise<string>;
  lock(): Promise<void>;
  sign(message: string): Promise<string>;
  saveVault(data: string): Promise<void>;
  loadVault(): Promise<string | null>;
}

const native: Keystore = {
  exists: (account) => invoke("wallet_exists", { account }),
  create: (account, password) => invoke("wallet_create", { account, password }),
  unlock: (account, password) => invoke("wallet_unlock", { account, password }),
  lock: () => invoke("wallet_lock"),
  sign: (message) => invoke("wallet_sign", { message }),
  saveVault: (data) => invoke("vault_save", { data }),
  loadVault: () => invoke("vault_load"),
};

const b64url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes as ArrayBuffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const fromB64url = (value: string) =>
  Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

function browserKeystore(): Keystore {
  let signingKey: CryptoKey | null = null;
  let wrappingKey: CryptoKey | null = null;
  let current = "";
  const storageKey = (account: string, kind: string) => `dw.dev.${kind}.${account}`;

  async function deriveKey(password: string, salt: Uint8Array) {
    const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: 600_000 },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  }
  async function seal(key: CryptoKey, data: ArrayBuffer | Uint8Array) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const sealed = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data as BufferSource);
    return `${b64url(iv)}.${b64url(sealed)}`;
  }
  async function open(key: CryptoKey, value: string) {
    const [iv, sealed] = value.split(".").map(fromB64url);
    try {
      return await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, sealed as BufferSource);
    } catch {
      throw new Error("Incorrect password");
    }
  }

  return {
    exists: async (account) => localStorage.getItem(storageKey(account, "wallet")) !== null,
    async create(account, password) {
      const pair = (await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"])) as CryptoKeyPair;
      const salt = crypto.getRandomValues(new Uint8Array(16));
      wrappingKey = await deriveKey(password, salt);
      const publicKey = b64url(await crypto.subtle.exportKey("raw", pair.publicKey));
      const sealedKey = await seal(wrappingKey, await crypto.subtle.exportKey("pkcs8", pair.privateKey));
      localStorage.setItem(storageKey(account, "wallet"), JSON.stringify({ salt: b64url(salt), sealedKey, publicKey }));
      signingKey = pair.privateKey;
      current = account;
      return publicKey;
    },
    async unlock(account, password) {
      const stored = JSON.parse(localStorage.getItem(storageKey(account, "wallet")) ?? "null");
      if (!stored) throw new Error("No wallet on this device");
      wrappingKey = await deriveKey(password, fromB64url(stored.salt));
      const pkcs8 = await open(wrappingKey, stored.sealedKey);
      signingKey = await crypto.subtle.importKey("pkcs8", pkcs8, "Ed25519", false, ["sign"]);
      current = account;
      return stored.publicKey;
    },
    async lock() {
      signingKey = wrappingKey = null;
    },
    async sign(message) {
      if (!signingKey) throw new Error("Wallet is locked");
      return b64url(await crypto.subtle.sign("Ed25519", signingKey, new TextEncoder().encode(message)));
    },
    async saveVault(data) {
      if (!wrappingKey) throw new Error("Wallet is locked");
      localStorage.setItem(storageKey(current, "vault"), await seal(wrappingKey, new TextEncoder().encode(data)));
    },
    async loadVault() {
      if (!wrappingKey) throw new Error("Wallet is locked");
      const stored = localStorage.getItem(storageKey(current, "vault"));
      return stored ? new TextDecoder().decode(await open(wrappingKey, stored)) : null;
    },
  };
}

export const keystore: Keystore = isTauri() ? native : browserKeystore();
