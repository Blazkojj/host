import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";

const navItems = [
  { to: "/", label: "Dashboard", admin: false },
  { to: "/bots", label: "Bots", admin: false },
  { to: "/servers", label: "Servers", admin: false },
  { to: "/admin", label: "Admin", admin: true }
];

export default function Layout() {
  const { user, logout } = useAuth();
  const panelAddress = typeof window !== "undefined" ? window.location.host : "localhost";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">HP</div>
          <div>
            <strong>HostPanel</strong>
            <p>Private game & bot hosting</p>
          </div>
        </div>

        <div className="sidebar-highlight">
          <span className="eyebrow">Panel address</span>
          <strong className="mono">{panelAddress}</strong>
          <p>Use this LAN address to open the panel and join provisioned servers from your network.</p>
        </div>

        <nav className="nav">
          {navItems
            .filter((item) => !item.admin || user?.role === "admin")
            .map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === "/"} className="nav-link">
                {item.label}
              </NavLink>
            ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-pill">
            <strong>{user?.email}</strong>
            <span>{user?.role}</span>
          </div>
          <button type="button" className="button button-ghost" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
