import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchStaffTickets, StaffTicketListItem } from "../api/staffQueue.js";
import { fetchCategories, CategoryDto } from "../api/tickets.js";

type LoadState = "loading" | "success" | "error";

const PRIORITY_STYLES: Record<string, { bg: string; color: string }> = {
  LOW: { bg: "#EAF6EF", color: "#1F2A24" },
  MEDIUM: { bg: "#FFF3DC", color: "#B26A00" },
  HIGH: { bg: "#FBE3E1", color: "#B3261E" },
};

function PriorityBadge({ value }: { value: string | null }) {
  if (!value) {
    return <span className="badge bg-secondary-subtle text-muted">—</span>;
  }
  const style = PRIORITY_STYLES[value] ?? { bg: "#eee", color: "#333" };
  return (
    <span className="badge" style={{ background: style.bg, color: style.color }}>
      {value.charAt(0) + value.slice(1).toLowerCase()}
    </span>
  );
}

export default function StaffTicketQueue() {
  const [tickets, setTickets] = useState<StaffTicketListItem[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loadState, setLoadState] = useState<LoadState>("loading");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [itPriorityFilter, setItPriorityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState<"all" | "unassigned" | "mine">("all");
  const [sort, setSort] = useState("status");
  const [order, setOrder] = useState<"asc" | "desc">("asc");

  const hasActiveFilters = Boolean(search || categoryFilter || itPriorityFilter || statusFilter || ownerFilter !== "all");

  useEffect(() => {
    fetchCategories().catch(() => undefined).then((cats) => cats && setCategories(cats));
  }, []);

  useEffect(() => {
    setLoadState("loading");
    fetchStaffTickets({
      search: search || undefined,
      categoryId: categoryFilter ? Number(categoryFilter) : undefined,
      itPriority: itPriorityFilter || undefined,
      currentStatus: statusFilter || undefined,
      owner: ownerFilter,
      sort,
      order,
      page,
      pageSize,
    })
      .then((res) => {
        setTickets(res.data);
        setTotalItems(res.pagination.totalItems);
        setLoadState("success");
      })
      .catch(() => setLoadState("error"));
  }, [search, categoryFilter, itPriorityFilter, statusFilter, ownerFilter, sort, order, page, pageSize]);

  function clearFilters() {
    setSearch("");
    setCategoryFilter("");
    setItPriorityFilter("");
    setStatusFilter("");
    setOwnerFilter("all");
    setPage(1);
  }

  function toggleSort(field: string) {
    if (sort === field) {
      setOrder(order === "asc" ? "desc" : "asc");
    } else {
      setSort(field);
      setOrder("asc");
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  return (
    <div>
      <div className="mb-3">
        <h1 className="h4 mb-1">Ticket Queue</h1>
        <p className="text-muted small mb-0">Find and prioritize work across all Requesters.</p>
      </div>

      <div className="card border-0 shadow-sm p-3 mb-3">
        <div className="row g-2">
          <div className="col-md-3">
            <input
              type="text"
              className="form-control"
              placeholder="Search by ticket number or summary…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div className="col-md-2">
            <select
              className="form-select"
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="col-md-2">
            <select
              className="form-select"
              value={itPriorityFilter}
              onChange={(e) => { setItPriorityFilter(e.target.value); setPage(1); }}
            >
              <option value="">All IT Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>
          <div className="col-md-2">
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Statuses</option>
              <option value="NEW">New</option>
            </select>
          </div>
          <div className="col-md-3">
            <select
              className="form-select"
              value={ownerFilter}
              onChange={(e) => { setOwnerFilter(e.target.value as "all" | "unassigned" | "mine"); setPage(1); }}
            >
              <option value="all">All Owners</option>
              <option value="unassigned">Unassigned</option>
              <option value="mine">Mine</option>
            </select>
          </div>
        </div>
        {hasActiveFilters && (
          <button className="btn btn-outline-secondary btn-sm mt-2" style={{ width: "fit-content" }} onClick={clearFilters}>
            Clear Filters
          </button>
        )}
      </div>

      {loadState === "loading" && <p className="text-muted">Loading…</p>}

      {loadState === "error" && (
        <div className="alert alert-danger">
          Unable to load the ticket queue. Please make sure the backend is running and try again.
        </div>
      )}

      {loadState === "success" && tickets.length === 0 && !hasActiveFilters && (
        <div className="card border-0 shadow-sm p-5 text-center">
          <p className="mb-0">No tickets in the system yet.</p>
        </div>
      )}

      {loadState === "success" && tickets.length === 0 && hasActiveFilters && (
        <div className="card border-0 shadow-sm p-5 text-center">
          <p className="mb-3">No tickets match your filters.</p>
          <button className="btn btn-outline-secondary mx-auto" style={{ width: "fit-content" }} onClick={clearFilters}>
            Clear Filters
          </button>
        </div>
      )}

      {loadState === "success" && tickets.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="card border-0 shadow-sm d-none d-md-block">
            <table className="table mb-0">
              <thead>
                <tr>
                  <th role="button" onClick={() => toggleSort("createdAt")}>
                    Ticket No. / Created Date {sort === "createdAt" && (order === "asc" ? "↑" : "↓")}
                  </th>
                  <th>Summary</th>
                  <th>Requested Priority</th>
                  <th role="button" onClick={() => toggleSort("itPriority")}>
                    IT Priority {sort === "itPriority" && (order === "asc" ? "↑" : "↓")}
                  </th>
                  <th role="button" onClick={() => toggleSort("status")}>
                    Status {sort === "status" && (order === "asc" ? "↑" : "↓")}
                  </th>
                  <th>Owner</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <div><Link to={`/staff/tickets/${t.id}`}>{t.ticketNumber}</Link></div>
                      <div className="small text-muted">{new Date(t.createdAt).toLocaleDateString()}</div>
                    </td>
                    <td>{t.summary}</td>
                    <td><PriorityBadge value={t.requestedPriority} /></td>
                    <td><PriorityBadge value={t.itPriority} /></td>
                    <td><span className="badge" style={{ background: "#EAF6EF", color: "#0B7A46" }}>{t.currentStatus}</span></td>
                    <td>
                      {t.ticketOwner ? t.ticketOwner.name : <span className="fst-italic text-muted">Unassigned</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile sort control */}
          <div className="d-md-none mb-2">
            <label htmlFor="mobileSortSelect" className="small text-muted mb-1 d-block">
              Sort by
            </label>
            <select
              id="mobileSortSelect"
              className="form-select form-select-sm"
              value={`${sort}-${order}`}
              onChange={(e) => {
                const [field, dir] = e.target.value.split("-");
                setSort(field);
                setOrder(dir as "asc" | "desc");
              }}
            >
              <option value="status-asc">Status</option>
              <option value="createdAt-desc">Created Date (newest first)</option>
              <option value="createdAt-asc">Created Date (oldest first)</option>
              <option value="itPriority-desc">IT Priority (high first)</option>
              <option value="updatedAt-desc">Last Updated (newest first)</option>
            </select>
          </div>

          {/* Mobile cards */}
          <div className="d-md-none d-flex flex-column gap-2">
            {tickets.map((t) => (
              <Link
                key={t.id}
                to={`/staff/tickets/${t.id}`}
                className="card border-0 shadow-sm p-3 text-decoration-none text-dark"
              >
                <div className="d-flex justify-content-between mb-1">
                  <strong>{t.ticketNumber}</strong>
                  <span className="badge" style={{ background: "#EAF6EF", color: "#0B7A46" }}>{t.currentStatus}</span>
                </div>
                <div className="mb-1">{t.summary}</div>
                <div className="d-flex flex-wrap gap-2 small text-muted align-items-center">
                  <PriorityBadge value={t.requestedPriority} />
                  <span>{t.ticketOwner ? t.ticketOwner.name : "Unassigned"}</span>
                  <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                </div>
              </Link>
            ))}
          </div>

          <div className="d-flex flex-wrap justify-content-between align-items-center mt-3 gap-2">
            <div className="d-none d-md-flex align-items-center gap-2">
              <label htmlFor="pageSizeSelect" className="small text-muted mb-0">Per page</label>
              <select
                id="pageSizeSelect"
                className="form-select form-select-sm"
                style={{ width: "auto" }}
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
            <div className="d-flex align-items-center gap-2">
              <button className="btn btn-sm btn-outline-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </button>
              <span className="small text-muted">Page {page} of {totalPages}</span>
              <button className="btn btn-sm btn-outline-secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
