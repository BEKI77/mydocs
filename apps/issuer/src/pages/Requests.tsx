import { documentTypeLabel } from '@dw/types'
import type { IssuerRequest, RequestStatus } from '@dw/types'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDate } from '../api.ts'
import StatusPill from '../components/StatusPill.tsx'
import { useResource } from '../hooks.ts'

const FILTERS: { value: RequestStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
]

export default function Requests() {
  const { data, error, loading } = useResource<IssuerRequest[]>('/issuer/verification-requests')
  const [filter, setFilter] = useState<RequestStatus | 'ALL'>('ALL')
  const [search, setSearch] = useState('')

  const all = data ?? []
  const count = (status: RequestStatus) => all.filter((r) => r.status === status).length
  const term = search.trim().toLowerCase()
  const rows = all.filter(
    (r) =>
      (filter === 'ALL' || r.status === filter) &&
      (!term || r.applicantName.toLowerCase().includes(term) || r.document.documentNumber.toLowerCase().includes(term)),
  )

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Verification requests</h1>
          <p className="lede">Check each document against issuer records, then verify or reject.</p>
        </div>
        <div className="field">
          <label htmlFor="search">Search</label>
          <input id="search" type="search" placeholder="Applicant or document number" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="stats">
        <div className="card stat"><div className="stat-label">Pending review</div><div className="stat-value">{count('PENDING')}</div></div>
        <div className="card stat"><div className="stat-label">Approved</div><div className="stat-value">{count('APPROVED')}</div></div>
        <div className="card stat"><div className="stat-label">Rejected</div><div className="stat-value">{count('REJECTED')}</div></div>
      </div>

      <div className="card">
        <div className="filters">
          {FILTERS.map((f) => (
            <button key={f.value} type="button" className="chip" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>
              {f.label}
            </button>
          ))}
        </div>
        {error && <p className="error pad" role="alert">{error}</p>}
        {loading && <p className="empty">Loading requests…</p>}
        {data && rows.length === 0 && (
          <p className="empty">{all.length === 0 ? 'No verification requests yet. They appear here when a wallet holder submits a document.' : 'No requests match this filter.'}</p>
        )}
        {rows.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Applicant</th>
                  <th scope="col">Document</th>
                  <th scope="col">Document number</th>
                  <th scope="col">Submitted</th>
                  <th scope="col">Status</th>
                  <th scope="col"><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="strong">{r.applicantName}</td>
                    <td>{documentTypeLabel(r.document.type)}</td>
                    <td className="mono">{r.document.documentNumber}</td>
                    <td className="muted">{formatDate(r.submittedAt)}</td>
                    <td><StatusPill status={r.status} /></td>
                    <td className="right">
                      <Link to={`/requests/${r.id}`} className={r.status === 'PENDING' ? 'button button-primary button-small' : 'text-link'}>
                        {r.status === 'PENDING' ? 'Review' : 'View'}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
