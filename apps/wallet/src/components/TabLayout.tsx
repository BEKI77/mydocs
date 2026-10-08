import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import Icon, { type IconName } from "./Icon";

const TABS: { to: string; label: string; icon: IconName }[] = [
  { to: "/wallet", label: "Wallet", icon: "wallet" },
  { to: "/requests", label: "Requests", icon: "clock" },
  { to: "/profile", label: "Profile", icon: "person" },
];

/** The three main sections share a floating bottom bar; detail screens render without it. */
export default function TabLayout() {
  const { pathname } = useLocation();
  return (
    <div className="tab-shell">
      <Outlet />
      {pathname !== "/profile" && (
        <Link to="/add" className="fab" aria-label="Add document">
          <Icon name="plus" size={26} stroke={2.2} />
        </Link>
      )}
      <nav className="tab-bar" aria-label="Main">
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} className="tab">
            <Icon name={tab.icon} size={22} />
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
