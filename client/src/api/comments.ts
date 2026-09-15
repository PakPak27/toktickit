const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface CommentDto {
  id: number;
  ticketId: number;
  authorId: number;
  authorName: string;
  authorRole: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
  content: string;
  createdAt: string;
}

export interface ResolvedConfirmationDto {
  requesterConfirmedResolved: boolean;
  requesterConfirmedResolvedAt: string | null;
}

export async function fetchComments(ticketId: number): Promise<CommentDto[]> {
  const res = await fetch(`${API_URL}/api/tickets/${ticketId}/comments`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Unable to load comments");
  return res.json();
}

export async function postComment(ticketId: number, content: string): Promise<CommentDto> {
  const res = await fetch(`${API_URL}/api/tickets/${ticketId}/comments`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Unable to post comment" }));
    throw new Error(body.error || "Unable to post comment");
  }
  return res.json();
}

export async function markAppearsResolved(ticketId: number): Promise<ResolvedConfirmationDto> {
  const res = await fetch(`${API_URL}/api/tickets/${ticketId}/resolved-confirmation`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Unable to update ticket" }));
    throw new Error(body.error || "Unable to update ticket");
  }
  return res.json();
}
