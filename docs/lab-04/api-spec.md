# Lab 4 API Specification

Extends `docs/lab-03/api-spec.md` (auth, Requester, Staff, Admin endpoints
unchanged). This document covers only what Lab 4 adds or changes: Actions
Taken, the resolution gate + concurrency check on status changes, and the
two dashboard endpoints.

Common error shape, status codes, and session cookie are unchanged from
Lab 3. New status code in Lab 4: `409 Conflict` is also used for a stale
`updatedAt` (not just the existing "invalid transition"/"last Administrator"
cases) — the response body's `error.code` distinguishes them.

---

## Actions Taken

### GET /api/staff/tickets/:id/actions
Requires session, role `IT_STAFF`/`ADMINISTRATOR`.
- `200` → `[{ "id", "ticketId", "performedById", "performedByName", "description", "result", "followUpRequired", "followUpNote", "attachmentNotes", "createdAt", "updatedAt" }]` ordered newest first (`createdAt desc`).
- `404` → Ticket does not exist.

### POST /api/staff/tickets/:id/actions
Requires session, role `IT_STAFF`/`ADMINISTRATOR`. Body:
`{ "description": string, "result": string, "followUpRequired": boolean, "followUpNote"?: string, "attachmentNotes"?: string }`.
- `201` → the created Action Taken (same shape as GET's array items).
- `400` → `description`/`result` empty or over 2000 chars; `followUpRequired`
  true with `followUpNote` empty/missing; `attachmentNotes` over 500 chars.
- `404` → Ticket does not exist.

### PATCH /api/staff/tickets/:id/actions/:actionId
Requires session, role `IT_STAFF`/`ADMINISTRATOR`. Body: same fields as
POST, all optional (at least one required) **plus required**
`"updatedAt": "<ISO8601, the value last read for this Action Taken>"`.
- `200` → the updated Action Taken.
- `400` → no fields supplied; a supplied field fails its own validation
  (same rules as POST); `updatedAt` missing or not a valid timestamp.
- `404` → Ticket or Action Taken does not exist (or Action Taken does not
  belong to this Ticket).
- `409` → `{ "error": { "code": "STALE_UPDATE", "message": "...", "current": {<latest Action Taken>} } }` — the supplied `updatedAt` no longer matches
  the stored value.

### GET /api/tickets/:id/actions
Requires session; `REQUESTER` must own the Ticket (read-only — no POST/PATCH
exists on this path).
- `200` → same array shape as the staff GET, newest first.
- `403` → Ticket not owned by the caller.
- `404` → Ticket does not exist.

---

## Ticket Status — Lab 4 additions

### PATCH /api/staff/tickets/:id/status (extends Lab 3)
Body now: `{ "currentStatus": "<status>", "updatedAt": "<ISO8601, the Ticket's updatedAt the client last read>" }`.
- `200` → `{ "currentStatus" }` (unchanged shape).
- `400` → not a recognized status value; `updatedAt` missing/invalid.
- `404` → Ticket does not exist.
- `409` → one of three distinguishable cases, same HTTP status, different `error.code`:
  - `"INVALID_TRANSITION"` — not permitted by the matrix (Lab 3 behavior, unchanged).
  - `"UNASSIGNED"` — target requires a Ticket Owner (Lab 3 BR-19, unchanged).
  - `"RESOLUTION_BLOCKED"` — target is `RESOLVED` and either zero Actions Taken exist or at least one has `followUpRequired = true` (Lab 4 BR-11/BR-12). Response includes `"blockingActions": [{ "id", "description" }]` for the open-follow-up case so the UI can link directly to the offending entry.
  - `"STALE_UPDATE"` — supplied `updatedAt` does not match the stored Ticket, same shape as the Action Taken case above.

---

## Dashboards

### GET /api/dashboard/requester
Requires session, role `REQUESTER`.
- `200` →
```json
{
  "metrics": {
    "openCount": 3,
    "inProgressCount": 2,
    "waitingForRequesterCount": 1,
    "resolvedCount": 5,
    "closedCount": 12
  },
  "recentTickets": [
    { "id", "ticketNumber", "summary", "currentStatus", "updatedAt" }
  ],
  "attentionTickets": [
    { "id", "ticketNumber", "summary", "currentStatus", "updatedAt" }
  ]
}
```
  `recentTickets` = the caller's own 5 most-recently-updated Tickets, any
  status. `attentionTickets` = the caller's own Tickets currently
  `WAITING_FOR_REQUESTER`, most-recently-updated first, capped at 5.
  `openCount` sums every status except `RESOLVED`/`CLOSED`/`CANCELLED`.

### GET /api/dashboard/staff
Requires session, role `IT_STAFF`/`ADMINISTRATOR`.
- `200` →
```json
{
  "metrics": {
    "newCount": 14,
    "openCount": 23,
    "inProgressCount": 18,
    "waitingForRequesterCount": 7,
    "unassignedCount": 9,
    "myAssignedCount": 16
  },
  "recentTickets": [
    { "id", "ticketNumber", "summary", "currentStatus", "ticketOwnerName", "updatedAt" }
  ]
}
```
  Every count except `myAssignedCount`/`unassignedCount` is scoped across
  all Requesters/owners (matches the Ticket Queue's own scope, not the
  viewer's). `myAssignedCount` = Tickets with `ticketOwnerId = session user
  id`. `recentTickets` = the 5 most-recently-updated Tickets system-wide.

Both dashboard responses are deliberately small (counts + ≤5-row lists,
never a full Ticket collection) per labsheet §6.2.
