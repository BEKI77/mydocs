import type { AuthSession } from "@dw/types";
import { useSyncExternalStore } from "react";

// Held in memory only: closing the app signs the user out, and signing back in
// with the password is also what unlocks the on-device key.
let session: AuthSession | null = null;
// False while sign-in is still setting up the device key, so the UI stays on the
// sign-in screen until the wallet is usable.
let ready = false;
const listeners = new Set<() => void>();

/** Current tokens, for the API client. Available as soon as sign-in succeeds. */
export const getSession = () => session;

/** Replaces the tokens. `isReady` is left unchanged when omitted (token refresh). */
export function setSession(next: AuthSession | null, isReady?: boolean) {
  session = next;
  ready = next !== null && (isReady ?? ready);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The signed-in session, once its wallet is ready. */
export const useSession = () => useSyncExternalStore(subscribe, () => (ready ? session : null));
