const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface InternalNoteDto {
  id: number;
  ticketId: number;
  authorId: number;
  authorName: string;
  authorRole: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
  content: string;
  createdAt: string;
}

export interface AttachmentDto {
  id: number;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  uploadedAt: string;
  removedAt: string | null;
  removalReason: string | null;
}

export interface StaffTicketDetailDto {
  id: number;
  ticketNumber: string;
  requesterId: number;
  requester: { id: number; name: string; email: string };
  category: { id: number; name: string };
  relatedSystem: { id: number; name: string };
  summary: string;
  description: string;
  requestedPriority: "LOW" | "MEDIUM" | "HIGH";
  itPriority: "LOW" | "MEDIUM" | "HIGH" | null;
  currentStatus: string;
  validNextStatuses: string[];
  ticketOwner: { id: number; name: string } | null;
  requesterConfirmedResolved: boolean;
  requesterConfirmedResolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  attachments: AttachmentDto[];
  internalNotes: InternalNoteDto[];
}

export class AccessDeniedError extends Error {}
export class NotFoundError extends Error {}

export interface AssignableUserDto {
  id: number;
  name: string;
}

export async function fetchAssignableUsers(): Promise<AssignableUserDto[]> {
  const res = await fetch(`${API_URL}/api/staff/assignable-users`, { credentials: "include" });
  if (!res.ok) throw new Error("Unable to load assignable users");
  return res.json();
}

export async function fetchStaffTicketDetail(ticketId: string): Promise<StaffTicketDetailDto> {
  const res = await fetch(`${API_URL}/api/staff/tickets/${ticketId}`, { credentials: "include" });
  if (res.status === 403) throw new AccessDeniedError("You do not have access to this ticket");
  if (res.status === 404) throw new NotFoundError("Ticket not found");
  if (!res.ok) throw new Error("Unable to load ticket");
  return res.json();
}

async function patchJson(path: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: "Unable to save changes" }));
    const err = new Error(errBody.error || "Unable to save changes") as Error & { validNextStatuses?: string[] };
    if (errBody.validNextStatuses) err.validNextStatuses = errBody.validNextStatuses;
    throw err;
  }
  return res.json();
}

export function updateTicketOwner(ticketId: number, ticketOwnerId: number | null) {
  return patchJson(`/api/staff/tickets/${ticketId}/owner`, { ticketOwnerId });
}

export function updateItPriority(ticketId: number, itPriority: "LOW" | "MEDIUM" | "HIGH") {
  return patchJson(`/api/staff/tickets/${ticketId}/priority`, { itPriority });
}

export function updateStatus(ticketId: number, currentStatus: string) {
  return patchJson(`/api/staff/tickets/${ticketId}/status`, { currentStatus });
}

export async function postInternalNote(ticketId: number, content: string): Promise<InternalNoteDto> {
  const res = await fetch(`${API_URL}/api/staff/tickets/${ticketId}/notes`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Unable to post note" }));
    throw new Error(body.error || "Unable to post note");
  }
  return res.json();
}
