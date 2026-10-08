import type { CheckName, VerificationResult } from '@dw/types'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, formatDate, formatExpiry } from '../api.ts'

const CHECK_LABELS: Record<CheckName, string> = {
  signature: 'Signature valid',
  issuer: 'Issuer trusted',
  expiration: 'Not expired',
  revocation: 'Not revoked',
  presentation: 'Presentation valid',
}

// A token is single-use, so the redemption must run once even if the effect re-runs.
const redemptions = new Map<string, Promise<VerificationResult>>()
function redeem(token: string) {
  let pending = redemptions.get(token)
  if (!pending) {
    pending = api.post<VerificationResult>(`/presentations/${token}/verify`, {}, false)
    redemptions.set(token, pending)
  }
  return pending
}

function Entry() {
  const navigate = useNavigate()
  const [value, setValue] = useState('')
  function submit(event: FormEvent) {
    event.preventDefault()
    const token = value.trim().split('/').pop()
    if (token) navigate(`/v/${token}`)
  }
  return (
    <form className="verify-card" onSubmit={submit}>
      <h1>Verify a document</h1>
      <p className="lede">Scan the QR code shown in the holder's wallet with your camera, or paste the verification link.</p>
      <div className="field">
        <label htmlFor="link">Verification link or code</label>
        <input id="link" type="text" required value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
      <button type="submit" className="button button-primary">Verify</button>
    </form>
  )
}

export default function Verify() {
  const { token } = useParams()
  const [result, setResult] = useState<VerificationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    redeem(token)
      .then((r) => !cancelled && setResult(r))
      .catch((e: Error) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [token])

  if (!token) return <div className="verify"><Entry /></div>

  return (
    <div className="verify">
      <div className="verify-card" aria-live="polite">
        {!result && !error && <p className="muted">Verifying…</p>}
        {error && (
          <>
            <div className="verdict verdict-bad">✗ INVALID DOCUMENT</div>
            <p>This verification code is not recognised. Ask the holder to present again.</p>
          </>
        )}
        {result && (
          <>
            <div className={`verdict ${result.valid ? 'verdict-ok' : 'verdict-bad'}`}>
              {result.valid ? '✓ VALID DOCUMENT' : '✗ INVALID DOCUMENT'}
            </div>
            {result.reason && <p><span className="muted">Reason: </span>{result.reason}</p>}
            {result.credential && (
              <div className="facts">
                <div><span>Document</span><span className="strong">{result.credential.documentType}</span></div>
                <div><span>Name</span><span className="strong">{result.credential.name}</span></div>
                <div><span>Issuer</span><span>{result.credential.issuer}</span></div>
                <div><span>Status</span><span className="strong">{result.valid ? 'VALID' : 'INVALID'}</span></div>
                <div><span>Issued</span><span>{formatDate(result.credential.issuedAt)}</span></div>
                <div><span>Expires</span><span>{formatExpiry(result.credential.expiresAt)}</span></div>
              </div>
            )}
            {result.checks.length > 0 && (
              <ul className="checks">
                {result.checks.map((check) => (
                  <li key={check.name} className={check.passed ? 'check-ok' : 'check-bad'}>
                    <span aria-hidden="true">{check.passed ? '✓' : '✗'}</span> {CHECK_LABELS[check.name]}
                    <span className="sr-only">{check.passed ? ' passed' : ' failed'}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  )
}
