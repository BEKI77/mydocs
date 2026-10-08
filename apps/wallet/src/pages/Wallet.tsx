import { credentialTypeLabel } from "@dw/types";
import { Link } from "react-router-dom";
import Badge from "../components/Badge";
import Icon from "../components/Icon";
import { usePolled } from "../hooks";
import { formatExpiry, listCredentials, maskNumber } from "../services/credentials";
import { listDocuments } from "../services/verification";

export default function Wallet() {
  const credentials = usePolled(listCredentials, 5000);
  const documents = usePolled(listDocuments, 5000);

  const creds = credentials.data?.credentials ?? [];
  const active = creds.filter((c) => c.status === "ACTIVE").length;
  const inReview = (documents.data ?? []).filter((d) => d.verification?.status === "PENDING").length;
  const loading = !credentials.data && !credentials.error;

  return (
    <div className="screen tab-screen">
      <div className="tab-head">
        <div>
          <div className="eyebrow">Good to see you</div>
          <h1 className="title">My wallet</h1>
        </div>
        {active > 0 && (
          <div className="count-chip"><Icon name="shield" size={14} stroke={2.4} />{active} verified</div>
        )}
      </div>

      {credentials.data?.offline && <p className="notice">You're offline. Showing credentials saved on this device.</p>}
      {credentials.error && <p className="error" role="alert">{credentials.error}</p>}
      {loading && <p className="muted center">Loading your wallet…</p>}

      {!loading && creds.length === 0 && (
        <div className="empty">
          <span className="empty-icon"><Icon name="document" size={28} stroke={1.8} /></span>
          <strong>No verified documents yet</strong>
          <span className="muted">Add a document and its issuer will verify it for your wallet.</span>
          <Link to="/add" className="button button-primary">Add document</Link>
        </div>
      )}

      {creds.length > 0 && (
        <div className="cred-grid">
          {creds.map((c, index) => {
            const dark = index === 0 && c.status === "ACTIVE";
            return (
              <Link key={c.id} to={`/credentials/${c.id}`} className={`cred-card${dark ? " cred-card-dark" : ""}`}>
                <span className="cred-row">
                  <Badge status={c.status} onDark={dark} />
                  <span className="cred-issuer">{c.issuer.name}</span>
                </span>
                <span className="cred-row cred-foot">
                  <span>
                    <span className="cred-name">{credentialTypeLabel(c.type)}</span>
                    <span className="mono cred-number">{maskNumber(c.subject.documentNumber)}</span>
                  </span>
                  <span className="cred-expiry">
                    <span className="overline">Valid until</span>
                    <span className="mono">{formatExpiry(c.expiresAt)}</span>
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {inReview > 0 && (
        <Link to="/requests" className="review-banner">
          <span><Icon name="clock" size={18} stroke={2.2} />{inReview} {inReview === 1 ? "document" : "documents"} in review</span>
          <span>View</span>
        </Link>
      )}
    </div>
  );
}
