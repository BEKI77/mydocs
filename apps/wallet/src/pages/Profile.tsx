import type { Wallet } from "@dw/types";
import { useEffect, useState } from "react";
import { version } from "../../package.json";
import Icon from "../components/Icon";
import { usePolled } from "../hooks";
import { api } from "../services/api";
import { signOut } from "../services/auth";
import { listCredentials } from "../services/credentials";
import { listDocuments } from "../services/verification";
import { useSession } from "../store/session";

export default function Profile() {
  const session = useSession();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const credentials = usePolled(listCredentials, 15000);
  const documents = usePolled(listDocuments, 15000);

  useEffect(() => {
    api.get<Wallet>("/wallet").then(setWallet).catch(() => {});
  }, []);

  const contact = session?.user.email ?? session?.user.phone ?? "";
  const verified = credentials.data?.credentials.filter((c) => c.status === "ACTIVE").length ?? 0;
  const inReview = documents.data?.filter((d) => d.verification?.status === "PENDING").length ?? 0;

  return (
    <div className="screen tab-screen">
      <h1 className="title">Profile</h1>

      <div className="account-card">
        <span className="avatar">{contact.slice(0, 2).toUpperCase()}</span>
        <span className="account-text">
          <span className="account-contact">{contact}</span>
          <span className="mono on-dark-muted">{wallet ? `wallet:${wallet.id.slice(0, 8)}` : " "}</span>
        </span>
      </div>

      <section className="stack">
        <h2 className="overline">Security</h2>
        <div className="list-card">
          <div className="list-row list-row-tall">
            <span className="list-icon"><Icon name="lock" size={20} stroke={1.9} /></span>
            <span>
              <span className="list-title">Device key</span>
              <span className="muted small">Stored on this phone, encrypted with your password</span>
            </span>
          </div>
        </div>
      </section>

      <section className="stack">
        <h2 className="overline">About</h2>
        <div className="list-card">
          <div className="list-row"><span>Documents</span><span className="muted">{verified} verified · {inReview} in review</span></div>
          <div className="list-row"><span>Version</span><span className="mono muted">{version}</span></div>
        </div>
      </section>

      <button type="button" className="button button-outline-danger" onClick={() => signOut()}>Sign out</button>
    </div>
  );
}
