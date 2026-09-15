import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";

const ROLE_LABELS: Record<string, string> = {
  REQUESTER: "Requester",
  IT_STAFF: "IT Staff",
  ADMINISTRATOR: "Administrator",
};

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <div style={{ background: "#F5F7F6", minHeight: "100vh" }}>
      <header
        style={{ background: "#006B3C" }}
        className="d-flex align-items-center justify-content-between px-4 py-3 text-white flex-wrap gap-2"
      >
        <Link to="/tickets" className="text-white text-decoration-none fw-bold fs-5">
          TokTickIT
        </Link>

        {user && user.role === "REQUESTER" && (
          <nav className="d-flex gap-3">
            <Link
              to="/tickets"
              className="text-white text-decoration-none"
              style={isActive("/tickets") ? { textDecoration: "underline", fontWeight: 600 } : {}}
            >
              My Tickets
            </Link>
            <Link
              to="/tickets/new"
              className="text-white text-decoration-none"
              style={isActive("/tickets/new") ? { textDecoration: "underline", fontWeight: 600 } : {}}
            >
              Create Ticket
            </Link>
          </nav>
        )}

        {user && (
          <div className="d-flex align-items-center gap-3">
            <span className="small">
              {user.name}{" "}
              <span className="badge bg-white text-dark">{ROLE_LABELS[user.role] ?? user.role}</span>
            </span>
            <button className="btn btn-sm btn-outline-light" onClick={handleLogout}>
              Logout
            </button>
          </div>
        )}
      </header>

      <main className="p-4">{children}</main>
    </div>
  );
}
