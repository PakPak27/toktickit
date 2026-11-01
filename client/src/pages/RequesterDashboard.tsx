import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchRequesterDashboard, RequesterDashboardDto, DashboardTicketSummary } from "../api/dashboard.js";
import MetricCard from "../components/MetricCard.js";

type LoadState = "loading" | "success" | "error";

function TicketRow({ ticket }: { ticket: DashboardTicketSummary }) {
  return (
    <Link
      to={`/tickets/${ticket.id}`}
      className="list-group-item list-group-item-action d-flex justify-content-between align-items-center flex-wrap gap-2"
    >
      <span>
        <strong>{ticket.ticketNumber}</strong> — {ticket.summary}
      </span>
      <span className="d-flex align-items-center gap-2">
        <span className="badge" style={{ background: "#EAF6EF", color: "#0B7A46" }}>
          {ticket.currentStatus}
        </span>
        <span className="small text-muted">{new Date(ticket.updatedAt).toLocaleDateString()}</span>
      </span>
    </Link>
  );
}

export default function RequesterDashboard() {
  const [data, setData] = useState<RequesterDashboardDto | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");

  function load() {
    setLoadState("loading");
    fetchRequesterDashboard()
      .then((res) => {
        setData(res);
        setLoadState("success");
      })
      .catch(() => setLoadState("error"));
  }

  useEffect(load, []);

  if (loadState === "loading") {
    return (
      <div>
        <h1 className="h4 mb-3">Dashboard</h1>
        <p className="text-muted">Loading your dashboard…</p>
      </div>
    );
  }

  if (loadState === "error" || !data) {
    return (
      <div>
        <h1 className="h4 mb-3">Dashboard</h1>
        <div className="alert alert-danger d-flex justify-content-between align-items-center">
          <span>Unable to load your dashboard. Please try again.</span>
          <button className="btn btn-sm btn-outline-danger" onClick={load}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const totalTickets =
    data.metrics.openCount + data.metrics.inProgressCount + data.metrics.waitingForRequesterCount + data.metrics.resolvedCount + data.metrics.closedCount;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <h1 className="h4 mb-0">Dashboard</h1>
        <div className="d-flex gap-2">
          <Link to="/tickets/new" className="btn btn-success btn-sm">
            + Create Ticket
          </Link>
          <Link to="/tickets" className="btn btn-outline-secondary btn-sm">
            View My Tickets
          </Link>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-6 col-md-2">
          <MetricCard label="Open" value={data.metrics.openCount} to="/tickets?statusGroup=active" />
        </div>
        <div className="col-6 col-md-2">
          <MetricCard label="In Progress" value={data.metrics.inProgressCount} to="/tickets?status=IN_PROGRESS" />
        </div>
        <div className="col-6 col-md-2">
          <MetricCard label="Waiting for Requester" value={data.metrics.waitingForRequesterCount} to="/tickets?status=WAITING_FOR_REQUESTER" />
        </div>
        <div className="col-6 col-md-2">
          <MetricCard label="Resolved" value={data.metrics.resolvedCount} to="/tickets?status=RESOLVED" />
        </div>
        <div className="col-6 col-md-2">
          <MetricCard label="Closed" value={data.metrics.closedCount} to="/tickets?status=CLOSED" />
        </div>
      </div>

      {totalTickets === 0 ? (
        <div className="card border-0 shadow-sm p-5 text-center">
          <p className="mb-3">You haven't created any tickets yet.</p>
          <Link to="/tickets/new" className="btn btn-success mx-auto" style={{ width: "fit-content" }}>
            Create Ticket
          </Link>
        </div>
      ) : (
        <>
          {data.attentionTickets.length > 0 && (
            <div className="mb-4">
              <h2 className="h6 mb-2">Needs Your Attention</h2>
              <div className="list-group">
                {data.attentionTickets.map((t) => (
                  <TicketRow key={t.id} ticket={t} />
                ))}
              </div>
            </div>
          )}

          <div>
            <h2 className="h6 mb-2">Recently Updated</h2>
            <div className="list-group">
              {data.recentTickets.map((t) => (
                <TicketRow key={t.id} ticket={t} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
