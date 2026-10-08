import { type FormEvent, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Header from "../components/Header";
import Icon from "../components/Icon";
import { authenticate } from "../services/auth";

export default function Login() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"register" | "login">(params.get("mode") === "login" ? "login" : "register");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await authenticate(mode, identifier, password);
      navigate("/wallet", { replace: true });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="screen" onSubmit={submit}>
      <Header backTo="/" backLabel="Back" />
      <div>
        <h1 className="title">{mode === "register" ? "Create your wallet" : "Welcome back"}</h1>
        <p className="lede">Sign in or register with your phone number or email.</p>
      </div>

      <div className="segmented" role="group" aria-label="Account">
        <button type="button" aria-pressed={mode === "register"} onClick={() => setMode("register")}>Register</button>
        <button type="button" aria-pressed={mode === "login"} onClick={() => setMode("login")}>Sign in</button>
      </div>

      <div className="stack">
        <div className="field">
          <label htmlFor="identifier">Phone or email</label>
          <input id="identifier" type="text" inputMode="email" autoComplete="username" autoCapitalize="none" required placeholder="name@example.com" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} required minLength={8} placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
      </div>

      <div className="note">
        <span className="accent"><Icon name="lock" size={22} stroke={1.8} /></span>
        <span>A key pair is generated on this device when your wallet is created. Your private key never leaves it.</span>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      <div className="spacer" />
      <button type="submit" className="button button-primary" disabled={busy}>
        {busy ? "Securing your wallet…" : "Continue"}
      </button>
    </form>
  );
}
