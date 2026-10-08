import { credentialTypeLabel, documentTypeLabel } from "@dw/types";
import { Link } from "react-router-dom";
import Badge from "../components/Badge";
import Icon from "../components/Icon";
import { usePolled } from "../hooks";
import { signOut } from "../services/auth";
import { formatDate, formatExpiry, listCredentials, maskNumber } from "../services/credentials";
import { listDocuments } from "../services/verification";
import { useSession } from "../store/session";

export default function Wallet() {
  const session = useSession();
  const credentials = usePolled(listCredentials, 5000);
  const documents = usePolled(listDocuments, 5000);

  const creds = credentials.data?.credentials ?? [];
  // Documents that have not (yet) turned into a credential.
  const open = (documents.data ?? []).filter((d) => !d.credentialId);
  const loading = !credentials.data && !credentials.error;
  const empty = !loading && creds.length === 0 && open.length === 0;

  return (
    <div className="screen">
      <div className="wallet-head">
        <div>
          <h1 className="title">My documents</h1>
          <div className="mono muted small">{session?.user.email ?? session?.user.phone}</div>
        </div>
        <button type="button" className="text-button" onClick={() => signOut()}>Sign out</button>
      </div>

      <Link to="/add" className="add-card">
        <span className="add-icon"><Icon name="plus" size={22} /></span>
        <span>
          <span className="add-title">Add document</span>
          <span className="muted small">Scan or upload, then submit for verification</span>
        </span>
      </Link>

      {credentials.data?.offline && <p className="notice">You're offline. Showing credentials saved on this device.</p>}
      {credentials.error && <p className="error" role="alert">{credentials.error}</p>}
      {loading && <p className="muted center">Loading your documents…</p>}
      {empty && <p className="muted center">No documents yet. Add one to have it verified by its issuer.</p>}

      {creds.length > 0 && (
        <section className="stack">
          <h2 className="overline">Credentials</h2>
          {creds.map((c, index) => {
            const dark = index === 0 && c.status === "ACTIVE";
            return (
              <Link key={c.id} to={`/credentials/${c.id}`} className={`cred-card${dark ? " cred-card-dark" : ""}`}>
                <span className="cred-row">
                  <span className="cred-name"><Icon name="document" size={22} stroke={1.8} />{credentialTypeLabel(c.type)}</span>
                  <Badge status={c.status} onDark={dark} />
                </span>
                <span className="cred-row cred-meta">
                  <span>
                    <span className="block">{c.issuer.name}</span>
                    <span className="mono">{maskNumber(c.subject.documentNumber)}</span>
                  </span>
                  <span>Valid until {formatExpiry(c.expiresAt)}</span>
                </span>
              </Link>
            );
          })}
        </section>
      )}

      {open.length > 0 && (
        <section className="stack">
          <h2 className="overline">In review</h2>
          {open.map((d) => (
            <Link key={d.id} to={`/documents/${d.id}`} className="doc-row">
              <span>
                <span className="doc-name">{documentTypeLabel(d.type)}</span>
                <span className="muted small">
                  {d.verification ? `Submitted ${formatDate(d.verification.submittedAt)}` : `Added ${formatDate(d.createdAt)}`}
                </span>
              </span>
              <Badge status={d.verification ? d.verification.status : "DRAFT"} />
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
