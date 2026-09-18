// specification.md §5.5 — the authoritative status transition matrix.
// Claiming/assigning a Ticket Owner and changing Current Status are
// independent operations (see the note under the matrix): this module only
// answers "is FROM -> TO a permitted transition", never touches ownership.
export const STATUS_TRANSITIONS: Record<string, string[]> = {
  NEW: ["OPEN", "IN_PROGRESS", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["OPEN", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["OPEN", "IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  CANCELLED: [],
};

export const ALL_STATUSES = Object.keys(STATUS_TRANSITIONS);

// BR-19: RESOLVED additionally requires an assigned Ticket Owner — that
// precondition lives outside the matrix since it depends on ticket state,
// not just the FROM/TO status pair.
export function validNextStatuses(from: string): string[] {
  return STATUS_TRANSITIONS[from] ?? [];
}

export function isValidTransition(from: string, to: string): boolean {
  return validNextStatuses(from).includes(to);
}
