import { documentTypeLabel } from "@dw/types";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Badge from "../components/Badge";
import Header from "../components/Header";
import Icon from "../components/Icon";
import { usePolled } from "../hooks";
import { formatDate, maskNumber } from "../services/credentials";
import { deleteDocument, listDocuments, submitForVerification } from "../services/verification";

const COPY: Record<string, string> = {
  PENDING: "Waiting for the issuer to check your document against their records.",
  APPROVED: "The issuer verified this document and signed a credential for your wallet.",
  REJECTED: "The issuer could not verify this document.",
  DRAFT: "This document has not been submitted for verification yet.",
};

export default function Verification() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, error: loadError, refresh } = usePolled(listDocuments, 5000);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const document = data?.find((d) => d.id === id);
  if (loadError && !data) return <div className="screen"><Header backTo="/wallet" backLabel="Back to wallet" /><p className="error" role="alert">{loadError}</p></div>;
  if (!data) return <div className="screen"><p className="muted center">Loading…</p></div>;
  if (!document) return <div className="screen"><Header backTo="/wallet" backLabel="Back to wallet" /><p className="muted">This document is no longer in your wallet.</p></div>;

  const status = document.verification?.status ?? "DRAFT";
  const reviewed = status === "APPROVED" || status === "REJECTED";

  async function run(action: () => Promise<unknown>, then?: () => void) {
    setBusy(true);
    setError(null);
    try {
      await action();
      then ? then() : await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <Header backTo="/wallet" backLabel="Back to wallet" />
      <div className="stack-tight">
        <Badge status={status === "APPROVED" ? "VERIFIED" : status} />
        <h1 className="title title-large">{documentTypeLabel(document.type)}</h1>
        <p className="lede">{COPY[status]}</p>
      </div>

      {document.verification?.rejectionReason && (
        <div className="note note-bad"><span><strong>Reason from the issuer: </strong>{document.verification.rejectionReason}</span></div>
      )}

      <div className="facts">
        {document.verification && <div><span>Submitted</span><span>{formatDate(document.verification.submittedAt)}</span></div>}
        {document.verification && <div><span>Issuer</span><span>{document.verification.issuerName}</span></div>}
        <div><span>Name</span><span>{document.metadata.name}</span></div>
        <div><span>Document number</span><span className="mono">{maskNumber(document.metadata.documentNumber)}</span></div>
      </div>

      {status !== "DRAFT" && (
        <ol className="timeline">
          <li className="done"><span className="dot"><Icon name="check" size={14} stroke={3} /></span><span><strong>Document submitted</strong><span className="muted small">Scan and details sent securely</span></span></li>
          <li className={reviewed ? (status === "REJECTED" ? "failed" : "done") : "current"}>
            <span className="dot">{reviewed && <Icon name={status === "REJECTED" ? "cross" : "check"} size={14} stroke={3} />}</span>
            <span><strong>Issuer review</strong><span className="muted small">{status === "PENDING" ? "Waiting for issuer…" : status === "REJECTED" ? "Not verified" : "Checked against issuer records"}</span></span>
          </li>
          <li className={status === "APPROVED" ? "done" : "upcoming"}>
            <span className="dot">{status === "APPROVED" && <Icon name="check" size={14} stroke={3} />}</span>
            <span><strong>Signed credential issued</strong><span className="muted small">{status === "APPROVED" ? "Stored in this wallet" : "Delivered to this wallet once approved"}</span></span>
          </li>
        </ol>
      )}

      {error && <p className="error" role="alert">{error}</p>}
      <div className="spacer" />
      <div className="stack">
        {document.credentialId ? (
          <Link to={`/credentials/${document.credentialId}`} className="button button-primary">View credential</Link>
        ) : (
          <>
            {(status === "REJECTED" || status === "DRAFT") && (
              <button type="button" className="button button-primary" disabled={busy} onClick={() => run(() => submitForVerification(document.id))}>
                {status === "REJECTED" ? "Submit again" : "Submit for verification"}
              </button>
            )}
            <Link to="/wallet" className="button button-ink">Back to wallet</Link>
            <button type="button" className="button button-ghost button-danger" disabled={busy} onClick={() => run(() => deleteDocument(document.id), () => navigate("/wallet", { replace: true }))}>
              {status === "PENDING" ? "Withdraw request" : "Remove document"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
