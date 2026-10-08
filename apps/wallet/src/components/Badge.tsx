import Icon, { type IconName } from "./Icon";

const BADGES: Record<string, { label: string; tone: string; icon: IconName }> = {
  ACTIVE: { label: "VERIFIED", tone: "ok", icon: "check" },
  VERIFIED: { label: "VERIFIED", tone: "ok", icon: "check" },
  PENDING: { label: "PENDING", tone: "pending", icon: "clock" },
  REJECTED: { label: "REJECTED", tone: "bad", icon: "cross" },
  REVOKED: { label: "REVOKED", tone: "bad", icon: "cross" },
  EXPIRED: { label: "EXPIRED", tone: "muted", icon: "clock" },
  DRAFT: { label: "NOT SUBMITTED", tone: "muted", icon: "document" },
};

export default function Badge({ status, onDark = false }: { status: string; onDark?: boolean }) {
  const badge = BADGES[status] ?? BADGES.DRAFT;
  return (
    <span className={`badge badge-${badge.tone}${onDark ? " badge-on-dark" : ""}`}>
      <Icon name={badge.icon} size={12} stroke={3} />
      {badge.label}
    </span>
  );
}
