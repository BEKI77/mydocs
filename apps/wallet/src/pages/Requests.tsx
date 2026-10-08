import { documentTypeLabel, type WalletDocument } from "@dw/types";
import { useState } from "react";
import { Link } from "react-router-dom";
import Badge from "../components/Badge";
import { usePolled } from "../hooks";
import { formatDate } from "../services/credentials";
import { listDocuments } from "../services/verification";

type Filter = "ALL" | "REVIEW" | "ACTION";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "REVIEW", label: "In review" },
  { value: "ACTION", label: "Needs action" },
];

const statusOf = (d: WalletDocument) => d.verification?.status ?? "DRAFT";
const needsAction = (d: WalletDocument) => statusOf(d) === "REJECTED" || statusOf(d) === "DRAFT";

/** How far a request has got: submitted → issuer review → credential issued. */
function Progress({ status }: { status: string }) {
  const steps =
    status === "APPROVED" ? ["done", "done", "done"]
    : status === "REJECTED" ? ["done", "failed", "todo"]
    : status === "PENDING" ? ["done", "current", "todo"]
    : ["todo", "todo", "todo"];
  return (
    <span className="progress" aria-hidden="true">
      {steps.map((step, i) => <span key={i} className={`progress-${step}`} />)}
    </span>
  );
}

export default function Requests() {
  const { data, error } = usePolled(listDocuments, 5000);
  const [filter, setFilter] = useState<Filter>("ALL");

  const rows = (data ?? []).filter((d) =>
    filter === "ALL" ? true : filter === "REVIEW" ? statusOf(d) === "PENDING" : needsAction(d),
  );

  return (
    <div className="screen tab-screen">
      <div>
        <div className="eyebrow">Sent to issuers</div>
        <h1 className="title">Requests</h1>
      </div>

      <div className="chips" role="group" aria-label="Filter requests">
        {FILTERS.map((f) => (
          <button key={f.value} type="button" className="chip" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>
            {f.label}
          </button>
        ))}
      </div>

      {error && !data && <p className="error" role="alert">{error}</p>}
      {!data && !error && <p className="muted center">Loading requests…</p>}
      {data && rows.length === 0 && (
        <p className="muted center">
          {data.length === 0 ? "Nothing submitted yet. Add a document to send it for verification." : "No requests match this filter."}
        </p>
      )}

      <div className="request-list">
        {rows.map((d) => {
          const status = statusOf(d);
          return (
            <Link key={d.id} to={`/documents/${d.id}`} className="request-card">
              <span className="cred-row">
                <span className="request-name">{documentTypeLabel(d.type)}</span>
                <Badge status={status === "APPROVED" ? "VERIFIED" : status} />
              </span>
              <Progress status={status} />
              {d.verification?.rejectionReason && <span className="request-reason">{d.verification.rejectionReason}</span>}
              <span className="cred-row request-meta">
                <span>{d.verification?.issuerName ?? "Not submitted"}</span>
                <span>
                  {status === "REJECTED" ? <strong className="accent">Submit again</strong>
                    : d.verification ? `Submitted ${formatDate(d.verification.submittedAt)}`
                    : `Added ${formatDate(d.createdAt)}`}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
