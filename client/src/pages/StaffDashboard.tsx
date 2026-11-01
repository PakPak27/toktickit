import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchStaffDashboard, StaffDashboardDto, StaffDashboardTicketSummary } from "../api/dashboard.js";
import MetricCard from "../components/MetricCard.js";

type LoadState = "loading" | "success" | "error";

function TicketRow({ ticket }: { ticket: StaffDashboardTicketSummary }) {
  return (
    <Link
      to={`/staff/tickets/${ticket.id}`}
      className="list-group-item list-group-item-action d-flex justify-content-between align-items-center flex-wrap gap-2"
    >
      <span>
        <strong>{ticket.ticketNumber}</strong> — {ticket.summary}
      </span>
      <span className="d-flex align-items-center gap-2">
        <span className="badge" style={{ background: "#EAF6EF", color: "#0B7A46" }}>
          {ticket.currentStatus}
        </span>
        <span className="small text-muted">{ticket.ticketOwnerName ?? "Unassigned"}</span>
        <span className="small text-muted">{new Date(ticket.updatedAt).toLocaleDateString()}</span>
      </span>
    </Link>
  );
}

export default function StaffDashboard() {
  const [data, setData] = useState<StaffDashboardDto | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");

  function load() {
    setLoadState("loading");
    fetchStaffDashboard()
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

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <h1 className="h4 mb-0">Dashboard</h1>
        <Link to="/staff/queue" className="btn btn-outline-secondary btn-sm">
          View Ticket Queue
        </Link>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-6 col-md-2">
          <MetricCard label="New" value={data.metrics.newCount} to="/staff/queue?status=NEW" />
        </div>
        <div className="col-6 col-md-2">
          <MetricCard label="Open" value={data.metrics.openCount} to="/staff/queue?status=OPEN" />
        </div>
        <div className="col-6 col-md-2">
          <MetricCard label="In Progress" value={data.metrics.inProgressCount} to="/staff/queue?status=IN_PROGRESS" />
        </div>
        <div className="col-6 col-md-2">
          <MetricCard label="Waiting for Requester" value={data.metrics.waitingForRequesterCount} to="/staff/queue?status=WAITING_FOR_REQUESTER" />
        </div>
        <div className="col-6 col-md-2">
          <MetricCard label="Unassigned" value={data.metrics.unassignedCount} to="/staff/queue?ownership=unassigned" />
        </div>
        <div className="col-6 col-md-2">
          <MetricCard label="My Assigned" value={data.metrics.myAssignedCount} to="/staff/queue?ownership=mine" />
        </div>
      </div>

      {data.recentTickets.length === 0 ? (
        <div className="card border-0 shadow-sm p-5 text-center">
          <p className="mb-0">No tickets in the system yet.</p>
        </div>
      ) : (
        <div>
          <h2 className="h6 mb-2">Recently Updated</h2>
          <div className="list-group">
            {data.recentTickets.map((t) => (
              <TicketRow key={t.id} ticket={t} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
