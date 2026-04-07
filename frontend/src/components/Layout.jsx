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

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">HP</div>
          <div>
            <strong>HostPanel</strong>
            <p>Docker hosting</p>
          </div>
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
