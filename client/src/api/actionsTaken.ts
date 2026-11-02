const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface ActionTakenDto {
  id: number;
  ticketId: number;
  performedById: number;
  performedByName: string;
  description: string;
  result: string;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActionTakenInput {
  description: string;
  result: string;
  followUpRequired: boolean;
  followUpNote?: string;
  attachmentNotes?: string;
}

// Carries the current record from a 409 (api-spec.md) so the caller can
// reload the form with it instead of silently discarding the user's edit.
export class StaleActionError extends Error {
  current: ActionTakenDto;
  constructor(current: ActionTakenDto) {
    super("This entry changed since you opened it");
    this.current = current;
  }
}

function errorMessage(body: unknown, fallback: string): string {
  const error = (body as { error?: unknown } | null)?.error;
  return typeof error === "string" ? error : fallback;
}

export async function fetchStaffActionsTaken(ticketId: number): Promise<ActionTakenDto[]> {
  const res = await fetch(`${API_URL}/api/staff/tickets/${ticketId}/actions`, { credentials: "include" });
  if (!res.ok) throw new Error("Unable to load actions taken");
  return res.json();
}

export async function fetchRequesterActionsTaken(ticketId: number): Promise<ActionTakenDto[]> {
  const res = await fetch(`${API_URL}/api/tickets/${ticketId}/actions`, { credentials: "include" });
  if (!res.ok) throw new Error("Unable to load actions taken");
  return res.json();
}

export async function createActionTaken(ticketId: number, input: ActionTakenInput): Promise<ActionTakenDto> {
  const res = await fetch(`${API_URL}/api/staff/tickets/${ticketId}/actions`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(errorMessage(body, "Unable to record this action"));
  }
  return res.json();
}

export async function updateActionTaken(
  ticketId: number,
  actionId: number,
  input: Partial<ActionTakenInput> & { updatedAt: string }
): Promise<ActionTakenDto> {
  const res = await fetch(`${API_URL}/api/staff/tickets/${ticketId}/actions/${actionId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (res.status === 409) {
    const body = await res.json().catch(() => null);
    const current = (body as { error?: { current?: ActionTakenDto } } | null)?.error?.current;
    if (current) throw new StaleActionError(current);
    throw new Error("This entry changed since you opened it");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(errorMessage(body, "Unable to save this action"));
  }
  return res.json();
}
