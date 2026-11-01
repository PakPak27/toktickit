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
import {
  fetchStaffActionsTaken,
  createActionTaken,
  updateActionTaken,
  ActionTakenDto,
  StaleActionError,
} from "../api/actionsTaken.js";
import { useAuth } from "../context/AuthContext.js";

type LoadState = "loading" | "success" | "denied" | "notfound" | "error";
type Tab = "actions" | "comments" | "notes" | "attachments";

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

  const [actions, setActions] = useState<ActionTakenDto[]>([]);
  const [actionsError, setActionsError] = useState("");

  const [showAddAction, setShowAddAction] = useState(false);
  const [newDescription, setNewDescription] = useState("");
  const [newResult, setNewResult] = useState("");
  const [newFollowUpRequired, setNewFollowUpRequired] = useState(false);
  const [newFollowUpNote, setNewFollowUpNote] = useState("");
  const [newAttachmentNotes, setNewAttachmentNotes] = useState("");
  const [addActionError, setAddActionError] = useState("");
  const [addingAction, setAddingAction] = useState(false);

  const [editingActionId, setEditingActionId] = useState<number | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editResult, setEditResult] = useState("");
  const [editFollowUpRequired, setEditFollowUpRequired] = useState(false);
  const [editFollowUpNote, setEditFollowUpNote] = useState("");
  const [editAttachmentNotes, setEditAttachmentNotes] = useState("");
  const [editBaseUpdatedAt, setEditBaseUpdatedAt] = useState("");
  const [editActionError, setEditActionError] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editConflict, setEditConflict] = useState<ActionTakenDto | null>(null);

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
  useEffect(() => {
    if (ticket) fetchStaffActionsTaken(ticket.id).then(setActions).catch(() => setActionsError("Unable to load actions taken"));
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

  async function handleAddAction(e: React.FormEvent) {
    e.preventDefault();
    if (!ticket) return;
    setAddActionError("");
    if (!newDescription.trim() || !newResult.trim()) {
      setAddActionError("Description and Result are both required");
      return;
    }
    if (newFollowUpRequired && !newFollowUpNote.trim()) {
      setAddActionError("A follow-up note is required when follow-up is needed");
      return;
    }
    setAddingAction(true);
    try {
      const created = await createActionTaken(ticket.id, {
        description: newDescription.trim(),
        result: newResult.trim(),
        followUpRequired: newFollowUpRequired,
        followUpNote: newFollowUpRequired ? newFollowUpNote.trim() : undefined,
        attachmentNotes: newAttachmentNotes.trim() || undefined,
      });
      setActions((prev) => [created, ...prev]);
      setNewDescription("");
      setNewResult("");
      setNewFollowUpRequired(false);
      setNewFollowUpNote("");
      setNewAttachmentNotes("");
      setShowAddAction(false);
    } catch (err) {
      setAddActionError(err instanceof Error ? err.message : "Unable to record this action");
    } finally {
      setAddingAction(false);
    }
  }

  function startEditAction(action: ActionTakenDto) {
    setEditingActionId(action.id);
    setEditDescription(action.description);
    setEditResult(action.result);
    setEditFollowUpRequired(action.followUpRequired);
    setEditFollowUpNote(action.followUpNote ?? "");
    setEditAttachmentNotes(action.attachmentNotes ?? "");
    setEditBaseUpdatedAt(action.updatedAt);
    setEditActionError("");
    setEditConflict(null);
  }

  function cancelEditAction() {
    setEditingActionId(null);
    setEditActionError("");
    setEditConflict(null);
  }

  // ui-spec.md §5: a 409 reloads the current values into the form rather
  // than silently discarding the edit — the user decides what to do next.
  function reloadEditFromConflict() {
    if (!editConflict) return;
    setEditDescription(editConflict.description);
    setEditResult(editConflict.result);
    setEditFollowUpRequired(editConflict.followUpRequired);
    setEditFollowUpNote(editConflict.followUpNote ?? "");
    setEditAttachmentNotes(editConflict.attachmentNotes ?? "");
    setEditBaseUpdatedAt(editConflict.updatedAt);
    setActions((prev) => prev.map((a) => (a.id === editConflict.id ? editConflict : a)));
    setEditConflict(null);
  }

  async function handleSaveEditAction(e: React.FormEvent) {
    e.preventDefault();
    if (!ticket || editingActionId === null) return;
    setEditActionError("");
    if (!editDescription.trim() || !editResult.trim()) {
      setEditActionError("Description and Result are both required");
      return;
    }
    if (editFollowUpRequired && !editFollowUpNote.trim()) {
      setEditActionError("A follow-up note is required when follow-up is needed");
      return;
    }
    setSavingEdit(true);
    try {
      const updated = await updateActionTaken(ticket.id, editingActionId, {
        description: editDescription.trim(),
        result: editResult.trim(),
        followUpRequired: editFollowUpRequired,
        followUpNote: editFollowUpRequired ? editFollowUpNote.trim() : undefined,
        // Always sent (never `|| undefined`) so clearing the field on edit
        // actually clears it — the PATCH handler only touches a field when
        // it's present in the body, and the server already turns "" into
        // null.
        attachmentNotes: editAttachmentNotes.trim(),
        updatedAt: editBaseUpdatedAt,
      });
      setActions((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setEditingActionId(null);
    } catch (err) {
      if (err instanceof StaleActionError) {
        setEditConflict(err.current);
      } else {
        setEditActionError(err instanceof Error ? err.message : "Unable to save this action");
      }
    } finally {
      setSavingEdit(false);
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
              className={`nav-link ${tab === "actions" ? "active" : ""}`}
              onClick={() => setTab("actions")}
            >
              {`Actions Taken (${actions.length})`}
            </button>
          </li>
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

        {tab === "actions" && (
          <div>
            {actionsError && <div className="text-danger small mb-2">{actionsError}</div>}
            {actions.length === 0 && <p className="text-muted small">No actions recorded yet.</p>}

            <ul className="list-unstyled d-flex flex-column gap-3 mb-3">
              {actions.map((a) =>
                editingActionId === a.id ? (
                  <li key={a.id} className="p-3 rounded border" style={{ background: "#F5F7F6" }}>
                    {editConflict && (
                      <div className="alert alert-warning py-2 px-3 mb-3" role="alert">
                        This entry changed since you opened it. Your changes were not saved.{" "}
                        <button type="button" className="btn btn-link btn-sm p-0" onClick={reloadEditFromConflict}>
                          Reload
                        </button>
                      </div>
                    )}
                    <form onSubmit={handleSaveEditAction}>
                      <div className="mb-2">
                        <label htmlFor={`editDescription-${a.id}`} className="form-label small text-muted mb-1">
                          Description
                        </label>
                        <textarea
                          id={`editDescription-${a.id}`}
                          className="form-control"
                          rows={2}
                          maxLength={2000}
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          disabled={savingEdit}
                        />
                      </div>
                      <div className="mb-2">
                        <label htmlFor={`editResult-${a.id}`} className="form-label small text-muted mb-1">
                          Result
                        </label>
                        <textarea
                          id={`editResult-${a.id}`}
                          className="form-control"
                          rows={2}
                          maxLength={2000}
                          value={editResult}
                          onChange={(e) => setEditResult(e.target.value)}
                          disabled={savingEdit}
                        />
                      </div>
                      <div className="mb-2 form-check">
                        <input
                          id={`editFollowUpRequired-${a.id}`}
                          type="checkbox"
                          className="form-check-input"
                          checked={editFollowUpRequired}
                          onChange={(e) => setEditFollowUpRequired(e.target.checked)}
                          disabled={savingEdit}
                        />
                        <label htmlFor={`editFollowUpRequired-${a.id}`} className="form-check-label small">
                          Follow-Up Required
                        </label>
                      </div>
                      {editFollowUpRequired && (
                        <div className="mb-2">
                          <label htmlFor={`editFollowUpNote-${a.id}`} className="form-label small text-muted mb-1">
                            Follow-up Note
                          </label>
                          <textarea
                            id={`editFollowUpNote-${a.id}`}
                            className="form-control"
                            rows={2}
                            maxLength={1000}
                            value={editFollowUpNote}
                            onChange={(e) => setEditFollowUpNote(e.target.value)}
                            disabled={savingEdit}
                          />
                        </div>
                      )}
                      <div className="mb-3">
                        <label htmlFor={`editAttachmentNotes-${a.id}`} className="form-label small text-muted mb-1">
                          Attachment Notes
                        </label>
                        <input
                          id={`editAttachmentNotes-${a.id}`}
                          type="text"
                          className="form-control"
                          maxLength={500}
                          value={editAttachmentNotes}
                          onChange={(e) => setEditAttachmentNotes(e.target.value)}
                          disabled={savingEdit}
                        />
                      </div>
                      {editActionError && <div className="text-danger small mb-2">{editActionError}</div>}
                      <div className="d-flex gap-2">
                        <button type="submit" className="btn btn-success btn-sm" disabled={savingEdit}>
                          {savingEdit ? "Saving…" : "Save"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          onClick={cancelEditAction}
                          disabled={savingEdit}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </li>
                ) : (
                  <li key={a.id} className="p-2 rounded" style={{ background: "#F5F7F6" }}>
                    <div className="d-flex justify-content-between align-items-baseline">
                      <strong>{a.performedByName}</strong>
                      <span className="small text-muted">{new Date(a.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="small text-muted">Description</div>
                    <div>{a.description}</div>
                    <div className="small text-muted mt-1">Result</div>
                    <div title={a.result}>{a.result}</div>
                    <div className="d-flex align-items-center gap-2 mt-2">
                      {a.followUpRequired && (
                        <span className="badge" style={{ background: "#FFF3DC", color: "#B26A00" }}>
                          Follow-up needed
                        </span>
                      )}
                      {a.attachmentNotes && <span className="small text-muted">📎 {a.attachmentNotes}</span>}
                    </div>
                    {a.followUpRequired && a.followUpNote && (
                      <div className="small mt-1">
                        <span className="text-muted">Follow-up Note: </span>
                        {a.followUpNote}
                      </div>
                    )}
                    <button
                      type="button"
                      className="btn btn-link btn-sm p-0 mt-2"
                      onClick={() => startEditAction(a)}
                    >
                      Edit
                    </button>
                  </li>
                )
              )}
            </ul>

            {showAddAction ? (
              <form onSubmit={handleAddAction} className="p-3 rounded border" style={{ background: "#F5F7F6" }}>
                <div className="mb-2">
                  <label htmlFor="newActionDescription" className="form-label small text-muted mb-1">
                    Description
                  </label>
                  <textarea
                    id="newActionDescription"
                    className="form-control"
                    rows={2}
                    maxLength={2000}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    disabled={addingAction}
                  />
                </div>
                <div className="mb-2">
                  <label htmlFor="newActionResult" className="form-label small text-muted mb-1">
                    Result
                  </label>
                  <textarea
                    id="newActionResult"
                    className="form-control"
                    rows={2}
                    maxLength={2000}
                    value={newResult}
                    onChange={(e) => setNewResult(e.target.value)}
                    disabled={addingAction}
                  />
                </div>
                <div className="mb-2 form-check">
                  <input
                    id="newActionFollowUpRequired"
                    type="checkbox"
                    className="form-check-input"
                    checked={newFollowUpRequired}
                    onChange={(e) => setNewFollowUpRequired(e.target.checked)}
                    disabled={addingAction}
                  />
                  <label htmlFor="newActionFollowUpRequired" className="form-check-label small">
                    Follow-Up Required
                  </label>
                </div>
                {newFollowUpRequired && (
                  <div className="mb-2">
                    <label htmlFor="newActionFollowUpNote" className="form-label small text-muted mb-1">
                      Follow-up Note
                    </label>
                    <textarea
                      id="newActionFollowUpNote"
                      className="form-control"
                      rows={2}
                      maxLength={1000}
                      value={newFollowUpNote}
                      onChange={(e) => setNewFollowUpNote(e.target.value)}
                      disabled={addingAction}
                    />
                  </div>
                )}
                <div className="mb-3">
                  <label htmlFor="newActionAttachmentNotes" className="form-label small text-muted mb-1">
                    Attachment Notes
                  </label>
                  <input
                    id="newActionAttachmentNotes"
                    type="text"
                    className="form-control"
                    maxLength={500}
                    value={newAttachmentNotes}
                    onChange={(e) => setNewAttachmentNotes(e.target.value)}
                    disabled={addingAction}
                  />
                </div>
                {addActionError && <div className="text-danger small mb-2">{addActionError}</div>}
                <div className="d-flex gap-2">
                  <button type="submit" className="btn btn-success btn-sm" disabled={addingAction}>
                    {addingAction ? "Saving…" : "Add Action Taken"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => {
                      setShowAddAction(false);
                      setAddActionError("");
                      setNewDescription("");
                      setNewResult("");
                      setNewFollowUpRequired(false);
                      setNewFollowUpNote("");
                      setNewAttachmentNotes("");
                    }}
                    disabled={addingAction}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button type="button" className="btn btn-success btn-sm" onClick={() => setShowAddAction(true)}>
                Add Action Taken
              </button>
            )}
          </div>
        )}

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
