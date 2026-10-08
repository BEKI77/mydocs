import { Link } from "react-router-dom";
import Icon from "./Icon";

export default function Header({ title, backTo, backLabel }: { title?: string; backTo: string; backLabel: string }) {
  return (
    <header className="header">
      <Link to={backTo} className="icon-button" aria-label={backLabel}>
        <Icon name="back" />
      </Link>
      {title && <h1 className="header-title">{title}</h1>}
    </header>
  );
}
