import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  fetchTicketDetail,
  uploadAttachment,
  removeAttachment,
  downloadAttachment,
  TicketDetailDto,
  AccessDeniedError,
  NotFoundError,
} from "../api/ticketDetail.js";
import { useRequester } from "../context/RequesterContext.js";

type LoadState = "loading" | "success" | "denied" | "notfound" | "error";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const { requester } = useRequester();

  const [ticket, setTicket] = useState<TicketDetailDto | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);

  const [removingId, setRemovingId] = useState<number | null>(null);
  const [removalReason, setRemovalReason] = useState("");
  const [removeError, setRemoveError] = useState("");
  const [downloadError, setDownloadError] = useState("");

  function loadTicket() {
    if (!requester || !id) return;
    setLoadState("loading");
    fetchTicketDetail(requester.id, id)
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

  useEffect(loadTicket, [requester, id]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !requester || !ticket) return;

    setUploadError("");

    // Client-side pre-checks (BR-22/BR-23) — server re-validates regardless
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      setUploadError("File type not supported. Allowed: JPG, JPEG, PNG, WEBP, PDF");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File exceeds the 5MB size limit");
      return;
    }

    setUploading(true);
    try {
      await uploadAttachment(requester.id, ticket.id, file);
      loadTicket();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Unable to upload attachment");
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(attachmentId: number, fileName: string) {
    if (!requester) return;
    setDownloadError("");
    try {
      await downloadAttachment(requester.id, attachmentId, fileName);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Unable to download attachment");
    }
  }

  async function confirmRemove(attachmentId: number) {
    if (!requester) return;
    setRemoveError("");

    if (removalReason.trim().length < 3) {
      setRemoveError("A removal reason of at least 3 characters is required");
      return;
    }

    try {
      await removeAttachment(requester.id, attachmentId, removalReason.trim());
      setRemovingId(null);
      setRemovalReason("");
      loadTicket();
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : "Unable to remove attachment");
    }
  }

  if (loadState === "loading") return <p className="text-muted">Loading…</p>;

  if (loadState === "denied") {
    return (
      <div className="alert alert-danger">
        You do not have access to this ticket.{" "}
        <Link to="/tickets">Back to My Tickets</Link>
      </div>
    );
  }

  if (loadState === "notfound") {
    return (
      <div className="alert alert-warning">
        Ticket not found. <Link to="/tickets">Back to My Tickets</Link>
      </div>
    );
  }

  if (loadState === "error" || !ticket) {
    return (
      <div className="alert alert-danger">
        Unable to load this ticket. Please try again later.
      </div>
    );
  }

  const activeAttachments = ticket.attachments.filter((a) => !a.removedAt);
  const removedAttachments = ticket.attachments.filter((a) => a.removedAt);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h4 mb-0">Ticket {ticket.ticketNumber}</h1>
        <Link to="/tickets" className="btn btn-outline-secondary btn-sm">
          ← Back to My Tickets
        </Link>
      </div>

      {/* Read-only ticket header — Section 16 of ui-spec.md */}
      <div className="card border-0 shadow-sm p-4 mb-3">
        <div className="row g-3 mb-3">
          <div className="col-md-3">
            <div className="small text-muted">Ticket No.</div>
            <div className="p-2 rounded" style={{ background: "#F1EFE6" }}>{ticket.ticketNumber}</div>
          </div>
          <div className="col-md-3">
            <div className="small text-muted">Ticket Date</div>
            <div className="p-2 rounded" style={{ background: "#F1EFE6" }}>
              {new Date(ticket.createdAt).toLocaleString()}
            </div>
          </div>
          <div className="col-md-3">
            <div className="small text-muted">Category</div>
            <div className="p-2 rounded" style={{ background: "#F1EFE6" }}>{ticket.category.name}</div>
          </div>
          <div className="col-md-3">
            <div className="small text-muted">Related System</div>
            <div className="p-2 rounded" style={{ background: "#F1EFE6" }}>{ticket.relatedSystem.name}</div>
          </div>
        </div>

        <div className="row g-3 mb-3">
          <div className="col-md-4">
            <div className="small text-muted">Requested Priority</div>
            <div>{ticket.requestedPriority}</div>
          </div>
          <div className="col-md-4">
            <div className="small text-muted">IT Priority</div>
            <div>{ticket.itPriority ?? "—"}</div>
          </div>
          <div className="col-md-4">
            <div className="small text-muted">Current Status</div>
            <div>
              <span className="badge" style={{ background: "#EAF6EF", color: "#0B7A46" }}>
                {ticket.currentStatus}
              </span>
            </div>
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

      {/* Attachments — separate section, per Section 16 requirement */}
      <div className="card border-0 shadow-sm p-4">
        <h2 className="h5 mb-3">Attachments</h2>

        <div className="mb-3">
          <label htmlFor="attachmentInput" className="form-label small text-muted">
            Add an attachment (JPG, JPEG, PNG, WEBP, PDF — max 5MB, up to 5 active files)
          </label>
          <input
            id="attachmentInput"
            type="file"
            className="form-control"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            onChange={handleFileChange}
            disabled={uploading || activeAttachments.length >= 5}
          />
          {uploading && <div className="text-muted small mt-1">Uploading…</div>}
          {uploadError && <div className="text-danger small mt-1">{uploadError}</div>}
          {activeAttachments.length >= 5 && (
            <div className="text-muted small mt-1">Maximum of 5 active attachments reached.</div>
          )}
        </div>

        {ticket.attachments.length === 0 && (
          <p className="text-muted small">No attachments yet.</p>
        )}

        <ul className="list-unstyled d-flex flex-column gap-2">
          {activeAttachments.map((a) => (
            <li key={a.id} className="d-flex justify-content-between align-items-center p-2 rounded" style={{ background: "#F5F7F6" }}>
              <div>
                <div>{a.fileName}</div>
                <div className="small text-muted">{formatBytes(a.sizeBytes)} · uploaded {new Date(a.uploadedAt).toLocaleDateString()}</div>
              </div>
              <div className="d-flex gap-2">
                <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => handleDownload(a.id, a.fileName)}
                >
                  Download
                </button>
                {removingId === a.id ? (
                  <div className="d-flex gap-1 align-items-center">
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="Reason for removal…"
                      value={removalReason}
                      onChange={(e) => setRemovalReason(e.target.value)}
                      style={{ width: 180 }}
                    />
                    <button className="btn btn-sm btn-danger" onClick={() => confirmRemove(a.id)}>
                      Confirm
                    </button>
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => { setRemovingId(null); setRemovalReason(""); setRemoveError(""); }}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button className="btn btn-sm btn-outline-danger" onClick={() => setRemovingId(a.id)}>
                    Remove
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
        {removeError && <div className="text-danger small mt-2">{removeError}</div>}
        {downloadError && <div className="text-danger small mt-2">{downloadError}</div>}

        {removedAttachments.length > 0 && (
          <>
            <h3 className="h6 mt-4 mb-2 text-muted">Removed Attachments</h3>
            <ul className="list-unstyled d-flex flex-column gap-2">
              {removedAttachments.map((a) => (
                <li key={a.id} className="p-2 rounded" style={{ background: "#F1EFE6" }}>
                  <div className="text-decoration-line-through">{a.fileName}</div>
                  <div className="small text-muted">
                    Removed {new Date(a.removedAt!).toLocaleDateString()} — {a.removalReason}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}