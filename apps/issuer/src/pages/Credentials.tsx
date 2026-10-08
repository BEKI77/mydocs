import { credentialTypeLabel } from '@dw/types'
import type { AuditLogEntry, Credential } from '@dw/types'
import { useState } from 'react'
import { api, formatDate, formatExpiry } from '../api.ts'
import StatusPill from '../components/StatusPill.tsx'
import { useResource } from '../hooks.ts'

const ACTIONS: Record<string, string> = {
  'verification.approved': 'approved a request and signed credential',
  'verification.rejected': 'rejected verification request',
  'credential.revoked': 'revoked credential',
}

export default function Credentials() {
  const credentials = useResource<Credential[]>('/issuer/credentials')
  const audit = useResource<AuditLogEntry[]>('/issuer/audit-logs')
  const [confirming, setConfirming] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function revoke(id: string) {
    setError(null)
    try {
      await api.post(`/credentials/${id}/revoke`)
      setConfirming(null)
      credentials.reload()
      audit.reload()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <>
      <div>
        <h1>Credential history</h1>
        <p className="lede">Every credential this issuer has signed. Revoking takes effect on the next verification.</p>
      </div>

      <div className="card">
        {(credentials.error ?? error) && <p className="error pad" role="alert">{credentials.error ?? error}</p>}
        {credentials.loading && <p className="empty">Loading credentials…</p>}
        {credentials.data?.length === 0 && <p className="empty">No credentials issued yet. Verify a request to issue the first one.</p>}
        {credentials.data && credentials.data.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Credential</th>
                  <th scope="col">Holder</th>
                  <th scope="col">Type</th>
                  <th scope="col">Issued</th>
                  <th scope="col">Expires</th>
                  <th scope="col">Status</th>
                  <th scope="col"><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody>
                {credentials.data.map((c) => (
                  <tr key={c.id}>
                    <td className="mono">{c.id.slice(0, 8)}</td>
                    <td className="strong">{c.subject.fullName}</td>
                    <td>{credentialTypeLabel(c.type)}</td>
                    <td className="muted">{formatDate(c.issuedAt)}</td>
                    <td className="muted">{formatExpiry(c.expiresAt)}</td>
                    <td><StatusPill status={c.status} /></td>
                    <td className="right">
                      {c.status === 'ACTIVE' && confirming !== c.id && (
                        <button type="button" className="button button-danger button-small" onClick={() => setConfirming(c.id)}>Revoke</button>
                      )}
                      {c.status === 'ACTIVE' && confirming === c.id && (
                        <span className="row end">
                          <button type="button" className="button button-small" onClick={() => setConfirming(null)}>Keep</button>
                          <button type="button" className="button button-danger-solid button-small" onClick={() => revoke(c.id)}>Revoke credential</button>
                        </span>
                      )}
                      {c.status === 'REVOKED' && c.revokedAt && <span className="muted small">Revoked {formatDate(c.revokedAt)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <section className="card" aria-label="Audit log">
        <h2 className="card-title">Audit log</h2>
        {audit.data?.length === 0 && <p className="empty">No actions recorded yet.</p>}
        {audit.data?.map((entry) => (
          <div key={entry.id} className="audit-row">
            <div>
              <span className="strong">{entry.actor}</span> {ACTIONS[entry.action] ?? entry.action}{' '}
              {entry.resourceId && <span className="mono">{entry.resourceId.slice(0, 8)}</span>}
            </div>
            <div className="muted">{formatDate(entry.createdAt)}</div>
          </div>
        ))}
      </section>
    </>
  )
}
