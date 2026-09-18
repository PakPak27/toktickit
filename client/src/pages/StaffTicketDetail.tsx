import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  fetchStaffTicketDetail,
  fetchAssignableUsers,
  updateTicketOwner,
  updateItPriority,
  updateStatus,
  postInternalNote,
  StaffTicketDetailDto,
  AssignableUserDto,
  AccessDeniedError,
  NotFoundError,
} from "../api/staffTicketDetail.js";
import { fetchComments, postComment, CommentDto } from "../api/comments.js";
import { useAuth } from "../context/AuthContext.js";

type LoadState = "loading" | "success" | "denied" | "notfound" | "error";
type Tab = "comments" | "notes" | "attachments";

const ROLE_LABELS: Record<string, string> = {
  REQUESTER: "Requester",
  IT_STAFF: "IT Staff",
  ADMINISTRATOR: "Administrator",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function StaffTicketDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [ticket, setTicket] = useState<StaffTicketDetailDto | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [assignableUsers, setAssignableUsers] = useState<AssignableUserDto[]>([]);

  const [tab, setTab] = useState<Tab>("comments");

  const [ownerSaving, setOwnerSaving] = useState(false);
  const [ownerError, setOwnerError] = useState("");
  const [prioritySaving, setPrioritySaving] = useState(false);
  const [priorityError, setPriorityError] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState("");

  const [comments, setComments] = useState<CommentDto[]>([]);
  const [commentsError, setCommentsError] = useState("");
  const [newComment, setNewComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  const [notesError, setNotesError] = useState("");
  const [newNote, setNewNote] = useState("");
  const [postingNote, setPostingNote] = useState(false);

  function loadTicket() {
    if (!id) return;
    setLoadState("loading");
    fetchStaffTicketDetail(id)
      .then((data) => {
        setTicket(data);
        setLoadState("success");
      })
      .catch((err) => {
        if (err instanceof AccessDeniedError) setLoadState("denied");
        else if (err instanceof NotFoundError) setLoadState("notfound");
        else setLoadState("error");
      });
  }

  useEffect(loadTicket, [id]);
  useEffect(() => {
    fetchAssignableUsers().then(setAssignableUsers).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (ticket) fetchComments(ticket.id).then(setComments).catch(() => setCommentsError("Unable to load comments"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket?.id]);

  async function handleOwnerChange(value: string) {
    if (!ticket) return;
    setOwnerSaving(true);
    setOwnerError("");
    try {
      await updateTicketOwner(ticket.id, value === "" ? null : Number(value));
      loadTicket();
    } catch (err) {
      setOwnerError(err instanceof Error ? err.message : "Unable to update Ticket Owner");
    } finally {
      setOwnerSaving(false);
    }
  }

  async function handlePriorityChange(value: string) {
    if (!ticket) return;
    setPrioritySaving(true);
    setPriorityError("");
    try {
      await updateItPriority(ticket.id, value as "LOW" | "MEDIUM" | "HIGH");
      loadTicket();
    } catch (err) {
      setPriorityError(err instanceof Error ? err.message : "Unable to update IT Priority");
    } finally {
      setPrioritySaving(false);
    }
  }

  async function handleStatusChange(value: string) {
    if (!ticket || !value) return;
    setStatusSaving(true);
    setStatusError("");
    try {
      await updateStatus(ticket.id, value);
      loadTicket();
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Unable to update status");
    } finally {
      setStatusSaving(false);
    }
  }

  async function handlePostComment(e: React.FormEvent) {
    e.preventDefault();
    if (!ticket || !newComment.trim()) return;
    setPostingComment(true);
    setCommentsError("");
    try {
      const created = await postComment(ticket.id, newComment.trim());
      setComments((prev) => [...prev, created]);
      setNewComment("");
    } catch (err) {
      setCommentsError(err instanceof Error ? err.message : "Unable to post comment");
    } finally {
      setPostingComment(false);
    }
  }

  async function handlePostNote(e: React.FormEvent) {
    e.preventDefault();
    if (!ticket || !newNote.trim()) return;
    setPostingNote(true);
    setNotesError("");
    try {
      const created = await postInternalNote(ticket.id, newNote.trim());
      setTicket((prev) => (prev ? { ...prev, internalNotes: [...prev.internalNotes, created] } : prev));
      setNewNote("");
    } catch (err) {
      setNotesError(err instanceof Error ? err.message : "Unable to post note");
    } finally {
      setPostingNote(false);
    }
  }

  if (loadState === "loading") return <p className="text-muted">Loading…</p>;

  if (loadState === "denied") {
    return (
      <div className="alert alert-danger">
        You do not have access to this ticket. <Link to="/staff/queue">Back to Queue</Link>
      </div>
    );
  }
  if (loadState === "notfound") {
    return (
      <div className="alert alert-warning">
        Ticket not found. <Link to="/staff/queue">Back to Queue</Link>
      </div>
    );
  }
  if (loadState === "error" || !ticket) {
    return <div className="alert alert-danger">Unable to load this ticket. Please try again later.</div>;
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h4 mb-0">Ticket {ticket.ticketNumber}</h1>
        <Link to="/staff/queue" className="btn btn-outline-secondary btn-sm">
          ← Back to Queue
        </Link>
      </div>

      {/* Read-only header — ui-spec.md §7 */}
      <div className="card border-0 shadow-sm p-4 mb-3">
        <div className="row g-3 mb-3">
          <div className="col-md-3">
            <div className="small text-muted">Ticket No.</div>
            <div className="p-2 rounded" style={{ background: "#F1EFE6" }}>{ticket.ticketNumber}</div>
          </div>
          <div className="col-md-3">
            <div className="small text-muted">Category</div>
            <div className="p-2 rounded" style={{ background: "#F1EFE6" }}>{ticket.category.name}</div>
          </div>
          <div className="col-md-3">
            <div className="small text-muted">Related System</div>
            <div className="p-2 rounded" style={{ background: "#F1EFE6" }}>{ticket.relatedSystem.name}</div>
          </div>
          <div className="col-md-3">
            <div className="small text-muted">Requester</div>
            <div className="p-2 rounded" style={{ background: "#F1EFE6" }}>{ticket.requester.name}</div>
          </div>
        </div>

        {/* Editable operational fields — grouped together */}
        <div className="row g-3 mb-3">
          <div className="col-md-4">
            <label htmlFor="ownerSelect" className="form-label small text-muted mb-1">
              Ticket Owner {ownerSaving && <span className="text-muted">(saving…)</span>}
            </label>
            <select
              id="ownerSelect"
              className="form-select"
              value={ticket.ticketOwner?.id ?? ""}
              onChange={(e) => handleOwnerChange(e.target.value)}
              disabled={ownerSaving}
            >
              <option value="">Unassigned</option>
              {assignableUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            {!ticket.ticketOwner && user && (
              <button
                type="button"
                className="btn btn-link btn-sm p-0 mt-1"
                onClick={() => handleOwnerChange(String(user.id))}
                disabled={ownerSaving}
              >
                Claim for me
              </button>
            )}
            {ownerError && <div className="text-danger small mt-1">{ownerError}</div>}
          </div>

          <div className="col-md-4">
            <label htmlFor="itPrioritySelect" className="form-label small text-muted mb-1">
              IT Priority {prioritySaving && <span className="text-muted">(saving…)</span>}
            </label>
            <select
              id="itPrioritySelect"
              className="form-select"
              value={ticket.itPriority ?? ""}
              onChange={(e) => handlePriorityChange(e.target.value)}
              disabled={prioritySaving}
            >
              <option value="" disabled>Choose a priority…</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
            {priorityError && <div className="text-danger small mt-1">{priorityError}</div>}
          </div>

          <div className="col-md-4">
            <label htmlFor="statusSelect" className="form-label small text-muted mb-1">
              Current Status {statusSaving && <span className="text-muted">(saving…)</span>}
            </label>
            <select
              id="statusSelect"
              className="form-select"
              value=""
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={statusSaving}
            >
              <option value="" disabled>{ticket.currentStatus}</option>
              {ticket.validNextStatuses.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {statusError && <div className="text-danger small mt-1">{statusError}</div>}
          </div>
        </div>

        <div className="row g-3 mb-3">
          <div className="col-md-4">
            <div className="small text-muted">Requested Priority</div>
            <div>{ticket.requestedPriority}</div>
          </div>
          <div className="col-md-8">
            {ticket.requesterConfirmedResolved && (
              <span className="badge" style={{ background: "#EAF6EF", color: "#0B7A46" }}>
                Requester indicated this appears resolved on{" "}
                {new Date(ticket.requesterConfirmedResolvedAt!).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        <div className="mb-3">
          <div className="small text-muted">Summary</div>
          <div>{ticket.summary}</div>
        </div>
        <div>
          <div className="small text-muted">Description</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{ticket.description}</div>
        </div>
      </div>

      {/* Tabs — ui-spec.md §7 */}
      <div className="card border-0 shadow-sm p-4">
        <ul className="nav nav-tabs mb-3">
          <li className="nav-item">
            <button
              className={`nav-link ${tab === "comments" ? "active" : ""}`}
              onClick={() => setTab("comments")}
              aria-label="Public Comments, visible to Requester"
            >
              Public Comments
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${tab === "notes" ? "active" : ""}`}
              onClick={() => setTab("notes")}
              aria-label="Internal Notes, staff only"
            >
              Internal Notes
            </button>
          </li>
          <li className="nav-item">
            <button className={`nav-link ${tab === "attachments" ? "active" : ""}`} onClick={() => setTab("attachments")}>
              Attachments
            </button>
          </li>
        </ul>

        {tab === "comments" && (
          <div>
            {comments.length === 0 && <p className="text-muted small">No comments yet.</p>}
            <ul className="list-unstyled d-flex flex-column gap-3 mb-3">
              {comments.map((c) => (
                <li key={c.id} className="p-2 rounded" style={{ background: "#F5F7F6" }}>
                  <div className="d-flex justify-content-between align-items-baseline">
                    <strong>
                      {c.authorName}{" "}
                      <span className="badge bg-secondary-subtle text-muted fw-normal">{ROLE_LABELS[c.authorRole]}</span>
                    </strong>
                    <span className="small text-muted">{new Date(c.createdAt).toLocaleString()}</span>
                  </div>
                  <div>{c.content}</div>
                </li>
              ))}
            </ul>
            {commentsError && <div className="text-danger small mb-2">{commentsError}</div>}
            <form onSubmit={handlePostComment} className="d-flex gap-2">
              <input
                type="text"
                className="form-control"
                placeholder="Type your comment here…"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                disabled={postingComment}
                maxLength={2000}
              />
              <button type="submit" className="btn btn-success" disabled={postingComment || !newComment.trim()}>
                {postingComment ? "Posting…" : "Post Comment"}
              </button>
            </form>
          </div>
        )}

        {tab === "notes" && (
          <div>
            <div
              className="p-2 rounded small mb-3"
              style={{ background: "#FFF3DC", color: "#B26A00" }}
            >
              Internal — not visible to Requester
            </div>
            {ticket.internalNotes.length === 0 && <p className="text-muted small">No internal notes yet.</p>}
            <ul className="list-unstyled d-flex flex-column gap-3 mb-3">
              {ticket.internalNotes.map((n) => (
                <li key={n.id} className="p-2 rounded" style={{ background: "#FFF3DC" }}>
                  <div className="d-flex justify-content-between align-items-baseline">
                    <strong>
                      {n.authorName}{" "}
                      <span className="badge bg-secondary-subtle text-muted fw-normal">{ROLE_LABELS[n.authorRole]}</span>
                    </strong>
                    <span className="small text-muted">{new Date(n.createdAt).toLocaleString()}</span>
                  </div>
                  <div>{n.content}</div>
                </li>
              ))}
            </ul>
            {notesError && <div className="text-danger small mb-2">{notesError}</div>}
            <form onSubmit={handlePostNote} className="d-flex gap-2">
              <input
                type="text"
                className="form-control"
                placeholder="Type an internal note here…"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                disabled={postingNote}
                maxLength={2000}
              />
              <button type="submit" className="btn btn-success" disabled={postingNote || !newNote.trim()}>
                {postingNote ? "Posting…" : "Post Note"}
              </button>
            </form>
          </div>
        )}

        {tab === "attachments" && (
          <div>
            {ticket.attachments.length === 0 && <p className="text-muted small">No attachments.</p>}
            <ul className="list-unstyled d-flex flex-column gap-2">
              {ticket.attachments.map((a) => (
                <li key={a.id} className="p-2 rounded" style={{ background: a.removedAt ? "#F1EFE6" : "#F5F7F6" }}>
                  <div className={a.removedAt ? "text-decoration-line-through" : ""}>{a.fileName}</div>
                  <div className="small text-muted">
                    {formatBytes(a.sizeBytes)} · uploaded {new Date(a.uploadedAt).toLocaleDateString()}
                    {a.removedAt && ` · removed ${new Date(a.removedAt).toLocaleDateString()} — ${a.removalReason}`}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
