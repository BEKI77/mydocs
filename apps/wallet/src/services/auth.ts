import type { AuthSession, Wallet } from "@dw/types";
import { getSession, setSession } from "../store/session";
import { api } from "./api";
import { keystore } from "./wallet";

/**
 * Signs in (or registers), then makes sure this device holds an unlocked key
 * whose public half is registered with the wallet service.
 */
export async function authenticate(mode: "register" | "login", identifier: string, password: string) {
  const session = await api.post<AuthSession>(`/auth/${mode}`, { identifier, password }, false);
  if (session.user.role !== "holder") throw new Error("Use the issuer portal to sign in with this account.");
  setSession(session, false);
  try {
    const account = session.user.id;
    let publicKey: string;
    if (await keystore.exists(account)) {
      // A changed password can no longer open the old key file; a fresh key replaces it.
      publicKey = await keystore.unlock(account, password).catch(() => keystore.create(account, password));
    } else {
      publicKey = await keystore.create(account, password);
    }
    await api.post<Wallet>("/wallet", { publicKey });
    setSession(getSession(), true);
  } catch (error) {
    setSession(null);
    throw error;
  }
}

export async function signOut() {
  const session = getSession();
  setSession(null);
  await keystore.lock();
  if (session) await api.post("/auth/logout", { refreshToken: session.refreshToken }, false).catch(() => {});
}
