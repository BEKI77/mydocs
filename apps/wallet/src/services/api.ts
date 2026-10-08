import { getSession, setSession } from "../store/session";

const BASE_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function send(path: string, init: RequestInit, withAuth: boolean): Promise<Response> {
  const headers = new Headers(init.headers);
  const session = getSession();
  if (withAuth && session) headers.set("Authorization", `Bearer ${session.accessToken}`);
  try {
    return await fetch(`${BASE_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Check your connection and try again.");
  }
}

function json(method: string, body?: unknown): RequestInit {
  if (body === undefined) return { method };
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

let refreshing: Promise<boolean> | null = null;
function refresh(): Promise<boolean> {
  refreshing ??= (async () => {
    const session = getSession();
    if (!session) return false;
    const res = await send("/auth/refresh", json("POST", { refreshToken: session.refreshToken }), false);
    setSession(res.ok ? await res.json() : null);
    return res.ok;
  })().finally(() => (refreshing = null));
  return refreshing;
}

async function request(path: string, init: RequestInit, withAuth: boolean): Promise<Response> {
  let res = await send(path, init, withAuth);
  if (res.status === 401 && withAuth && (await refresh())) res = await send(path, init, true);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = Array.isArray(body?.message) ? body.message.join(". ") : body?.message;
    throw new ApiError(res.status, message ?? "Something went wrong. Try again.");
  }
  return res;
}

async function parse<T>(res: Response): Promise<T> {
  return res.status === 204 ? (undefined as T) : res.json();
}

export const api = {
  get: async <T>(path: string, withAuth = true) => parse<T>(await request(path, json("GET"), withAuth)),
  post: async <T>(path: string, body: unknown = {}, withAuth = true) =>
    parse<T>(await request(path, json("POST", body), withAuth)),
  upload: async <T>(path: string, form: FormData) => parse<T>(await request(path, { method: "POST", body: form }, true)),
  delete: async (path: string) => parse<void>(await request(path, json("DELETE"), true)),
};
