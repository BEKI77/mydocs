import type { AuthSession } from '@dw/types'

const BASE_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'
const STORAGE_KEY = 'dw.issuer.session'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

let session: AuthSession | null = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null')
const listeners = new Set<() => void>()

export const getSession = () => session
export function subscribeSession(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function setSession(next: AuthSession | null) {
  session = next
  if (next) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  else sessionStorage.removeItem(STORAGE_KEY)
  listeners.forEach((listener) => listener())
}

async function send(path: string, init: RequestInit, withAuth: boolean): Promise<Response> {
  const headers = new Headers(init.headers)
  if (withAuth && session) headers.set('Authorization', `Bearer ${session.accessToken}`)
  try {
    return await fetch(`${BASE_URL}${path}`, { ...init, headers })
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.')
  }
}

let refreshing: Promise<boolean> | null = null
function refresh(): Promise<boolean> {
  refreshing ??= (async () => {
    if (!session) return false
    const res = await send('/auth/refresh', json('POST', { refreshToken: session.refreshToken }), false)
    setSession(res.ok ? await res.json() : null)
    return res.ok
  })().finally(() => (refreshing = null))
  return refreshing
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
})

async function request(path: string, init: RequestInit, withAuth: boolean): Promise<Response> {
  let res = await send(path, init, withAuth)
  if (res.status === 401 && withAuth && (await refresh())) res = await send(path, init, true)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const message = Array.isArray(body?.message) ? body.message.join('. ') : body?.message
    throw new ApiError(res.status, message ?? 'Something went wrong. Try again.')
  }
  return res
}

export const api = {
  get: async <T>(path: string, withAuth = true): Promise<T> => (await request(path, json('GET'), withAuth)).json(),
  post: async <T>(path: string, body?: unknown, withAuth = true): Promise<T> =>
    (await request(path, json('POST', body ?? {}), withAuth)).json(),
  blob: async (path: string): Promise<Blob> => (await request(path, json('GET'), true)).blob(),

  async login(identifier: string, password: string) {
    const next: AuthSession = await (await request('/auth/login', json('POST', { identifier, password }), false)).json()
    if (next.user.role !== 'issuer') throw new ApiError(403, 'This account does not have access to the issuer portal.')
    setSession(next)
  },

  async logout() {
    const current = session
    setSession(null)
    if (current) await send('/auth/logout', json('POST', { refreshToken: current.refreshToken }), false).catch(() => {})
  },
}

export const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

/** Expiry is an end-of-day UTC instant; showing it in UTC keeps the date the issuer chose. */
export const formatExpiry = (value: string) =>
  new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
