import type { IssuerRequest } from '@dw/types'
import { NavLink, Outlet } from 'react-router-dom'
import { api } from '../api.ts'
import { useResource, useSession } from '../hooks.ts'

export function ShieldIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--mint)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l7 3v5.5c0 4.4-2.9 8.1-7 9.5-4.1-1.4-7-5.1-7-9.5V6l7-3z" />
      <path d="M8.8 12.2l2.3 2.3 4.2-4.6" />
    </svg>
  )
}

export default function Layout() {
  const session = useSession()
  const issuer = useResource<{ name: string }>('/issuer/me')
  const pending = useResource<IssuerRequest[]>('/issuer/verification-requests?status=PENDING')

  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Issuer portal">
        <div className="brand">
          <ShieldIcon />
          <div>
            <div className="brand-name">Issuer Portal</div>
            <div className="brand-org">{issuer.data?.name ?? ' '}</div>
          </div>
        </div>
        <div className="nav">
          <NavLink to="/requests">
            <span>Verification requests</span>
            {pending.data && pending.data.length > 0 && <span className="count">{pending.data.length}</span>}
          </NavLink>
          <NavLink to="/credentials">Credential history</NavLink>
        </div>
        <div className="account">
          <div className="account-email">{session?.user.email}</div>
          <button type="button" className="link-button" onClick={() => api.logout()}>
            Sign out
          </button>
        </div>
      </nav>
      <main className="content">
        <Outlet context={{ reloadPending: pending.reload }} />
      </main>
    </div>
  )
}
