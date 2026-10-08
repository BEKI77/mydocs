const TONES: Record<string, string> = {
  PENDING: 'pending',
  APPROVED: 'ok',
  ACTIVE: 'ok',
  REJECTED: 'bad',
  REVOKED: 'bad',
  EXPIRED: 'muted',
}

export default function StatusPill({ status }: { status: string }) {
  const label = status.charAt(0) + status.slice(1).toLowerCase()
  return <span className={`pill pill-${TONES[status] ?? 'muted'}`}>{label}</span>
}
