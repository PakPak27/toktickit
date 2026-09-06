const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface AttachmentDto {
  id: number;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  uploadedAt: string;
  removedAt: string | null;
  removalReason: string | null;
}

export interface TicketDetailDto {
  id: number;
  ticketNumber: string;
  requesterId: number;
  category: { id: number; name: string };
  relatedSystem: { id: number; name: string };
  summary: string;
  description: string;
  requestedPriority: "LOW" | "MEDIUM" | "HIGH";
  itPriority: "LOW" | "MEDIUM" | "HIGH" | null;
  currentStatus: string;
  createdAt: string;
  updatedAt: string;
  attachments: AttachmentDto[];
}

export class AccessDeniedError extends Error {}
export class NotFoundError extends Error {}

export async function fetchTicketDetail(requesterId: number, ticketId: string): Promise<TicketDetailDto> {
  const res = await fetch(`${API_URL}/api/tickets/${ticketId}`, {
    headers: { "X-Requester-Id": String(requesterId) },
  });

  if (res.status === 403) throw new AccessDeniedError("You do not have access to this ticket");
  if (res.status === 404) throw new NotFoundError("Ticket not found");
  if (!res.ok) throw new Error("Unable to load ticket");

  return res.json();
}

export async function uploadAttachment(
  requesterId: number,
  ticketId: number,
  file: File
): Promise<AttachmentDto> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_URL}/api/tickets/${ticketId}/attachments`, {
    method: "POST",
    headers: { "X-Requester-Id": String(requesterId) },
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Unable to upload attachment" }));
    throw new Error(body.error || "Unable to upload attachment");
  }

  return res.json();
}

export async function downloadAttachment(
  requesterId: number,
  attachmentId: number,
  fileName: string
): Promise<void> {
  const res = await fetch(`${API_URL}/api/attachments/${attachmentId}/download`, {
    headers: { "X-Requester-Id": String(requesterId) },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Unable to download attachment" }));
    throw new Error(body.error || "Unable to download attachment");
  }

  // Fetch the file as a blob, then trigger a real browser download via a
  // temporary object URL — <a href> alone can't send custom headers.
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function removeAttachment(
  requesterId: number,
  attachmentId: number,
  reason: string
): Promise<void> {
  const res = await fetch(`${API_URL}/api/attachments/${attachmentId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      "X-Requester-Id": String(requesterId),
    },
    body: JSON.stringify({ reason }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Unable to remove attachment" }));
    throw new Error(body.error || "Unable to remove attachment");
  }
}