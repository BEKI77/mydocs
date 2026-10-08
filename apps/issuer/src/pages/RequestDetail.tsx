import { documentTypeLabel } from '@dw/types'
import type { IssuerRequest } from '@dw/types'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { api, formatDate } from '../api.ts'
import StatusPill from '../components/StatusPill.tsx'
import { useResource } from '../hooks.ts'

function defaultExpiry(): string {
  const date = new Date()
  date.setFullYear(date.getFullYear() + 5)
  return date.toISOString().slice(0, 10)
}

function DocumentPreview({ request }: { request: IssuerRequest }) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rotation, setRotation] = useState(0)
  const isPdf = request.document.mimeType === 'application/pdf'

  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false
    api
      .blob(`/documents/${request.document.id}/file`)
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch((e: Error) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [request.document.id])

  return (
    <section className="card preview" aria-label="Uploaded document">
      <div className="preview-bar">
        <div className="strong">Uploaded document</div>
        <div className="row">
          {!isPdf && (
            <button type="button" className="button button-small" disabled={!url} onClick={() => setRotation((r) => (r + 90) % 360)}>
              Rotate
            </button>
          )}
          <a className="button button-small" href={url ?? undefined} target="_blank" rel="noreferrer" aria-disabled={!url}>
            Open full size
          </a>
        </div>
      </div>
      <div className="preview-stage">
        {error && <p className="error" role="alert">{error}</p>}
        {!url && !error && <p className="muted">Loading document…</p>}
        {url && isPdf && <iframe src={url} title="Uploaded PDF document" />}
        {url && !isPdf && <img src={url} alt={`Scan submitted by ${request.applicantName}`} style={{ transform: `rotate(${rotation}deg)` }} />}
      </div>
    </section>
  )
}

export default function RequestDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { reloadPending } = useOutletContext<{ reloadPending: () => void }>()
  const { data: request, error: loadError, reload } = useResource<IssuerRequest>(`/issuer/verification-requests/${id}`)
  const [checked, setChecked] = useState(false)
  const [expiresAt, setExpiresAt] = useState(defaultExpiry)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null)

  async function decide(action: 'approve' | 'reject') {
    if (action === 'approve' && !checked) return setError('Confirm that you checked this document against issuer records.')
    if (action === 'reject' && reason.trim().length < 3) return setError('Enter a rejection reason. It is shown to the applicant.')
    setBusy(action)
    setError(null)
    try {
      await api.post(
        `/issuer/verification-requests/${id}/${action}`,
        action === 'approve' ? { expiresAt: `${expiresAt}T23:59:59.000Z` } : { reason },
      )
      reloadPending()
      if (action === 'approve') navigate('/credentials')
      else reload()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  if (loadError) return <p className="error" role="alert">{loadError}</p>
  if (!request) return <p className="empty">Loading request…</p>

  return (
    <>
      <div>
        <Link to="/requests" className="back-link">‹ Verification requests</Link>
        <div className="title-row">
          <h1>{request.applicantName} · {documentTypeLabel(request.document.type)}</h1>
          <StatusPill status={request.status} />
        </div>
      </div>

      <div className="detail">
        <DocumentPreview request={request} />

        <div className="detail-side">
          <section className="card facts" aria-label="Submitted details">
            <div><span>Applicant</span><span className="strong">{request.applicantName}</span></div>
            <div><span>Document</span><span>{documentTypeLabel(request.document.type)}</span></div>
            <div><span>Document number</span><span className="mono">{request.document.documentNumber}</span></div>
            <div><span>Submitted</span><span>{formatDate(request.submittedAt)}</span></div>
            {request.document.description && <div><span>Note</span><span>{request.document.description}</span></div>}
            <div><span>Wallet</span><span className="mono">{request.document.walletId.slice(0, 8)}</span></div>
          </section>

          {request.status === 'PENDING' ? (
            <section className="card decision" aria-label="Decision">
              <h2>Decision</h2>
              <label className="check">
                <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
                <span>I checked this document against issuer records.</span>
              </label>
              <div className="field">
                <label htmlFor="expires">Credential valid until</label>
                <input id="expires" type="date" className="mono" value={expiresAt} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setExpiresAt(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="reason">Rejection reason <span className="muted">(required to reject)</span></label>
                <textarea id="reason" rows={2} placeholder="Shown to the applicant" value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              {error && <p className="error" role="alert">{error}</p>}
              <div className="row">
                <button type="button" className="button button-danger" disabled={busy !== null} onClick={() => decide('reject')}>
                  {busy === 'reject' ? 'Rejecting…' : 'Reject'}
                </button>
                <button type="button" className="button button-primary grow" disabled={busy !== null} onClick={() => decide('approve')}>
                  {busy === 'approve' ? 'Signing…' : 'Verify and sign'}
                </button>
              </div>
              <p className="hint">Verifying creates a credential signed with the issuer key and delivers it to the applicant's wallet.</p>
            </section>
          ) : (
            <section className="card decision" aria-label="Decision">
              <h2>{request.status === 'APPROVED' ? 'Verified' : 'Rejected'}</h2>
              <p className="hint">Reviewed {request.reviewedAt ? formatDate(request.reviewedAt) : ''}</p>
              {request.rejectionReason && <p>{request.rejectionReason}</p>}
              {request.status === 'APPROVED' && <Link to="/credentials" className="text-link">View in credential history</Link>}
            </section>
          )}
        </div>
      </div>
    </>
  )
}
