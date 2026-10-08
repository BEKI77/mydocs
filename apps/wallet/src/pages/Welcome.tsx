import { Link } from "react-router-dom";
import Badge from "../components/Badge";
import Icon from "../components/Icon";
import { useDarkScreen } from "../services/systemBars";

export default function Welcome() {
  useDarkScreen();
  return (
    <div className="screen screen-dark welcome">
      <div className="wordmark">
        <span className="mint"><Icon name="shield" size={28} stroke={1.8} /></span>
        Digital Wallet
      </div>

      <div className="welcome-art" aria-hidden="true">
        <div className="art-card art-card-back" />
        <div className="art-card art-card-front">
          <div className="art-row">
            <strong>National ID</strong>
            <Badge status="VERIFIED" />
          </div>
          <div className="art-lines"><span /><span /></div>
          <div className="mono muted">••••••789</div>
        </div>
      </div>

      <div className="welcome-copy">
        <h1>Your documents, verified at the source.</h1>
        <p>Securely store and verify your important documents.</p>
      </div>

      <div className="stack">
        <Link to="/auth?mode=register" className="button button-mint">Get started</Link>
        <Link to="/auth?mode=login" className="button button-ghost">I already have a wallet</Link>
      </div>
    </div>
  );
}
