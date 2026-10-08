import type { Presentation as Session, PresentationState } from "@dw/types";
import QRCode from "qrcode";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Header from "../components/Header";
import Icon from "../components/Icon";
import { useDarkScreen } from "../services/systemBars";
import { createPresentation, getPresentationState } from "../services/verification";

function Result({ valid }: { valid: boolean }) {
  return (
    <div className="screen result">
      <div className="result-head">
        <div className={`result-mark ${valid ? "result-ok" : "result-bad"}`}><Icon name={valid ? "check" : "cross"} size={48} stroke={2.4} /></div>
        <div className="overline">{valid ? "Verification successful" : "Verification failed"}</div>
        <h1 className={`result-verdict ${valid ? "accent" : "danger"}`}>{valid ? "VALID" : "INVALID"}</h1>
      </div>
      <p className="muted center">
        {valid
          ? "The verifier confirmed your credential. This code can no longer be used."
          : "The verifier could not confirm this credential. Check its status in your wallet."}
      </p>
      <div className="spacer" />
      <Link to="/wallet" replace className="button button-ink">Done</Link>
    </div>
  );
}

export default function Presentation() {
  const { id } = useParams();
  const [session, setSession] = useState<Session | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [state, setState] = useState<PresentationState | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const start = useCallback(async () => {
    setError(null);
    setState(null);
    setSession(null);
    try {
      const created = await createPresentation(id!);
      // The QR carries only the opaque session link, never credential data.
      setQr(await QRCode.toDataURL(created.verifyUrl, { margin: 1, width: 472, color: { dark: "#12211D" } }));
      setSession(created);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    // Each session is single-use, so make sure a re-run effect does not open a second one.
    if (started.current) return;
    started.current = true;
    start();
  }, [start]);

  const finished = state?.status === "VERIFIED";
  useDarkScreen(!finished);
  useEffect(() => {
    if (!session || finished) return;
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((new Date(session.expiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const countdown = setInterval(tick, 1000);
    const poll = setInterval(() => getPresentationState(session.token).then(setState).catch(() => {}), 2000);
    return () => {
      clearInterval(countdown);
      clearInterval(poll);
    };
  }, [session, finished]);

  if (finished) return <Result valid={state.result === "VALID"} />;

  const expired = session !== null && secondsLeft === 0;
  const clock = `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")}`;

  return (
    <div className="screen screen-dark">
      <Header title="Present document" backTo={`/credentials/${id}`} backLabel="Back to credential" />

      <div className="qr-card">
        {qr && session && !expired ? (
          <img src={qr} alt="QR code for the verifier to scan" />
        ) : (
          <div className="qr-placeholder">{error ? "Could not create a code" : expired ? "Code expired" : "Creating secure code…"}</div>
        )}
        {session && !expired && (
          <div className="qr-timer"><span className="accent"><Icon name="clock" size={15} stroke={2.2} /></span>Code expires in <span className="mono">{clock}</span></div>
        )}
      </div>

      {error && <p className="error error-on-dark" role="alert">{error}</p>}
      {session && !expired && <p className="waiting"><span className="pulse" />Waiting for verifier…</p>}

      <div className="disclosure">
        <div className="overline on-dark-muted">The verifier will see</div>
        <div>Name · Document type · Issuer · Validity · Issue and expiry dates</div>
        <div className="on-dark-muted small">Your scan and document number are not shared.</div>
      </div>

      <div className="spacer" />
      <div className="stack">
        {(expired || error) && <button type="button" className="button button-mint" onClick={start}>New code</button>}
        <Link to={`/credentials/${id}`} className="button button-ghost">Cancel</Link>
      </div>
    </div>
  );
}
