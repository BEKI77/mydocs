import { Link } from "react-router-dom";
import Icon from "./Icon";

/** Top row of a detail screen: a back button and a centred title. */
export default function Header({ title, backTo, backLabel }: { title?: string; backTo: string; backLabel: string }) {
  return (
    <header className="header">
      <Link to={backTo} className="back-button" aria-label={backLabel}>
        <Icon name="back" size={22} />
      </Link>
      {title && <h1 className="header-title">{title}</h1>}
      <span className="header-balance" aria-hidden="true" />
    </header>
  );
}
