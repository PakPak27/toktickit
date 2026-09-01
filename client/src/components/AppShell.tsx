import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useRequester } from "../context/RequesterContext.js";

export default function AppShell({ children }: { children: ReactNode }) {
  const { requester, clearRequester } = useRequester();
  const location = useLocation();
  const navigate = useNavigate();

  function handleChangeRequester() {
    clearRequester();
    navigate("/");
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

        {requester && (
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

        {requester && (
          <div className="d-flex align-items-center gap-3">
            <span className="small">{requester.name}</span>
            <button
              className="btn btn-sm btn-outline-light"
              onClick={handleChangeRequester}
            >
              Change Requester
            </button>
          </div>
        )}
      </header>

      <main className="p-4">{children}</main>
    </div>
  );
}