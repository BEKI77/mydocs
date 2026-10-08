import { credentialTypeLabel } from "@dw/types";
import { Link, useParams } from "react-router-dom";
import Badge from "../components/Badge";
import Header from "../components/Header";
import Icon from "../components/Icon";
import { usePolled } from "../hooks";
import { formatDate, listCredentials, maskNumber } from "../services/credentials";

const STATUS_LABEL = { ACTIVE: "Active", EXPIRED: "Expired", REVOKED: "Revoked" } as const;

export default function Credential() {
  const { id } = useParams();
  // Re-checked regularly so a revocation shows up without reopening the app.
  const { data, error } = usePolled(listCredentials, 10000);
  const credential = data?.credentials.find((c) => c.id === id);

  if (error && !data) return <div className="screen"><Header title="Credential" backTo="/wallet" backLabel="Back to wallet" /><p className="error" role="alert">{error}</p></div>;
  if (!data) return <div className="screen"><p className="muted center">Loading…</p></div>;
  if (!credential) return <div className="screen"><Header title="Credential" backTo="/wallet" backLabel="Back to wallet" /><p className="muted">This credential is no longer in your wallet.</p></div>;

  const active = credential.status === "ACTIVE";
  return (
    <div className="screen">
      <Header title="Credential" backTo="/wallet" backLabel="Back to wallet" />

      <div className={`cred-hero${active ? "" : " cred-hero-inactive"}`}>
        <div className="cred-row">
          <Badge status={credential.status} onDark />
          <span className="mint"><Icon name="shield" size={30} stroke={1.5} /></span>
        </div>
        <div>
          <div className="cred-hero-type">{credentialTypeLabel(credential.type)}</div>
          <div className="on-dark-muted">{credential.issuer.name}</div>
        </div>
        <div className="stack">
          <div><div className="overline on-dark-muted">Name</div><div className="cred-hero-name">{credential.subject.fullName}</div></div>
          <div className="cred-hero-grid">
            <div><div className="overline on-dark-muted">Document number</div><div className="mono">{maskNumber(credential.subject.documentNumber)}</div></div>
            <div><div className="overline on-dark-muted">Valid until</div><div className="mono">{credential.expiresAt.slice(0, 10)}</div></div>
          </div>
        </div>
      </div>

      {data.offline && <p className="notice">You're offline. Presenting needs a connection.</p>}

      <div className="facts">
        <div><span>Status</span><span className={active ? "strong accent" : "strong danger"}>{STATUS_LABEL[credential.status]}</span></div>
        <div><span>Issued</span><span>{formatDate(credential.issuedAt)}</span></div>
        {credential.revokedAt && <div><span>Revoked</span><span>{formatDate(credential.revokedAt)}</span></div>}
        <div><span>Signed by</span><span>{credential.issuer.name}</span></div>
        <div><span>Credential ID</span><span className="mono">{credential.id.slice(0, 8)}</span></div>
      </div>

      <div className="spacer" />
      {active ? (
        <Link to={`/credentials/${credential.id}/present`} className="button button-primary"><Icon name="qr" size={20} />Present with QR</Link>
      ) : (
        <p className="muted center">This credential is {STATUS_LABEL[credential.status].toLowerCase()} and can no longer be presented.</p>
      )}
    </div>
  );
}
