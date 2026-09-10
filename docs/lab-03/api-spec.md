# Lab 3 API Contract

All endpoints below require an authenticated session (`toktickit_session`
httpOnly cookie, BR-03) unless marked **public**. Every response replaces
Lab 2's `X-Requester-Id` header entirely — Requester ownership is derived
from the session (BR-09). Endpoints tagged **[MCP]** are gated by
`mustChangePassword`: they remain callable even while a password change is
pending; every other protected endpoint returns 403 with
`{ "error": "Password change required" }` until the user completes it (BR-06).

**CORS:** the server's `cors()` middleware must set an explicit origin
(`http://localhost:5173`, never `*`) and `credentials: true`; every
frontend request must pass `credentials: "include"`. Without both sides
configured, the browser silently drops the session cookie on every
cross-origin (`:5173` → `:3000`) call — see `specification.md` §11.

## 1. POST /api/auth/login — public
**Request body**
```json
{ "email": "janderson@toktickit.com", "password": "ChangeMe123!" }
```
**Response 200** — sets `toktickit_session` cookie:
```json
{ "id": 3, "name": "Jennifer Anderson", "role": "REQUESTER", "mustChangePassword": true }
```
**Response 401** — wrong password OR inactive account (identical message, BR-01/AC-02):
```json
{ "error": "Invalid email or password" }
```
**Response 400** — missing email/password.

## 2. POST /api/auth/logout — [MCP]
Clears the session cookie. **Response 200** `{ "success": true }`.

## 3. GET /api/auth/me — [MCP]
**Response 200**
```json
{ "id": 3, "name": "Jennifer Anderson", "email": "janderson@toktickit.com", "role": "REQUESTER", "mustChangePassword": false }
```
**Response 401** — no/expired/invalid session cookie.

## 4. POST /api/auth/change-password — [MCP]
**Request body**
```json
{ "currentPassword": "ChangeMe123!", "newPassword": "N3wSecret!Pass" }
```
**Response 200** — `{ "success": true }`; clears `mustChangePassword` (BR-08).
**Response 400** — new password fails rule check (BR-07), or equals current password.
**Response 401** — `currentPassword` incorrect.

## 5. POST /api/tickets — Requester
Unchanged request/response shape from Lab 2 (`docs/lab-02/api-spec.md` §4),
except `requesterId` is taken from the session, never the request body
(BR-09/AC-04). All Lab 2 validation (BR-15–18) is unchanged.

## 6. GET /api/tickets, GET /api/tickets/:id, attachment endpoints — Requester
Identical query parameters, response shapes, and status codes to
`docs/lab-02/api-spec.md` §5–10, with ownership now resolved from the
session. The `403` "not owned" case (AC-05) is unchanged in shape.

## 7. POST /api/tickets/:id/comments — Requester (own), IT Staff, Administrator
**Request body**
```json
{ "content": "Thanks for the update, still seeing the issue after restart." }
```
**Response 201**
```json
{ "id": 15, "ticketId": 42, "authorId": 3, "authorName": "Jennifer Anderson", "authorRole": "REQUESTER", "content": "Thanks for the update...", "createdAt": "2026-09-10T09:00:00.000Z" }
```
**Response 400** — empty/whitespace-only content, or >2000 chars (BR-26).
**Response 403** — Requester posting to a Ticket they do not own.

## 8. GET /api/tickets/:id/comments — Requester (own), IT Staff, Administrator
**Response 200** — array of Public Comments only, oldest-first, same shape as §7's response.

## 9. POST /api/tickets/:id/resolved-confirmation — Requester (own)
**Response 200**
```json
{ "requesterConfirmedResolved": true, "requesterConfirmedResolvedAt": "2026-09-10T09:05:00.000Z" }
```
**Response 409** — Ticket is already `CLOSED` or `CANCELLED` (BR-21).
**Response 403** — not owned by the requesting user.

## 10. GET /api/staff/tickets — IT Staff, Administrator
Ticket Queue: search/filter/sort/paginate across **all** Tickets.

**Query parameters**

| Param | Type | Default | Notes |
|---|---|---|---|
| `search` | string | — | matches ticketNumber or summary |
| `categoryId` | int | — | filter |
| `currentStatus` | string | — | filter |
| `itPriority` | LOW/MEDIUM/HIGH | — | filter |
| `owner` | `all`/`unassigned`/`mine` | `all` | `mine` = session user's id |
| `sort` | `status`/`createdAt`/`itPriority`/`updatedAt` | `status` | |
| `order` | asc/desc | `asc` | |
| `page` | int | `1` | |
| `pageSize` | 10/20/50 | `10` | |

Invalid values fall back to defaults silently (same rule as Lab 2 BR-14).

**Response 200**
```json
{
  "data": [
    {
      "id": 42, "ticketNumber": "TKT-2026-000042", "summary": "Laptop battery drains quickly",
      "categoryId": 2, "requestedPriority": "MEDIUM", "itPriority": "MEDIUM",
      "currentStatus": "IN_PROGRESS",
      "ticketOwner": { "id": 5, "name": "Michael Brown" },
      "createdAt": "2026-08-18T10:15:00.000Z", "updatedAt": "2026-09-01T08:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "pageSize": 10, "totalItems": 87, "totalPages": 9 }
}
```
`ticketOwner` is `null` when unassigned.

**Response 403** — caller is a Requester.

## 11. GET /api/staff/tickets/:id — IT Staff, Administrator
Same header/attachment shape as `GET /api/tickets/:id`, plus `ticketOwner`,
`requesterConfirmedResolved(At)`, and an `internalNotes` array (author name,
role, content, createdAt — never returned to a Requester, AC-06/AC-12).

**Response 403** — caller is a Requester.
**Response 404** — Ticket does not exist.

## 12. PATCH /api/staff/tickets/:id/owner — IT Staff, Administrator
**Request body**
```json
{ "ticketOwnerId": 5 }
```
`ticketOwnerId: null` unassigns. Target must be an active IT Staff/Administrator (BR-14).

**Response 200** — updated `{ "ticketOwner": { "id": 5, "name": "Michael Brown" } }`.
**Response 400** — target user is not active IT Staff/Administrator.
**Response 404** — Ticket or target user does not exist.

## 13. PATCH /api/staff/tickets/:id/priority — IT Staff, Administrator
**Request body** `{ "itPriority": "HIGH" }` → **Response 200** `{ "itPriority": "HIGH" }`.
**Response 400** — invalid enum value.

## 14. PATCH /api/staff/tickets/:id/status — IT Staff, Administrator
**Request body** `{ "currentStatus": "RESOLVED" }`

**Response 200**
```json
{ "currentStatus": "RESOLVED", "validNextStatuses": ["CLOSED", "REOPENED"] }
```
**Response 400** — transition not permitted from the current status (BR-17, AC-09):
```json
{ "error": "Cannot transition from NEW to RESOLVED", "validNextStatuses": ["OPEN", "IN_PROGRESS", "CANCELLED"] }
```
**Response 409** — transition to `RESOLVED` on an unassigned Ticket (BR-19, AC-10).

## 15. POST /api/staff/tickets/:id/notes — IT Staff, Administrator
**Request body** `{ "content": "Escalated to hardware vendor, ETA 3 days." }`
**Response 201** — same shape as §7 but `authorRole` is `IT_STAFF`/`ADMINISTRATOR`.
**Response 400** — empty/whitespace-only or >2000 chars (BR-26).
**Response 403** — caller is a Requester (AC-06).

## 16. GET /api/staff/tickets/:id/notes — IT Staff, Administrator
**Response 200** — array of Internal Notes, oldest-first. **Response 403** if caller is a Requester.

## 17. GET /api/admin/users — Administrator
**Query parameters:** `search` (name/email substring), `role` (optional exact filter).
No pagination, no multi-sort (per handout minimalism).

**Response 200**
```json
[
  { "id": 3, "name": "Jennifer Anderson", "email": "janderson@toktickit.com", "role": "REQUESTER", "isActive": true },
  { "id": 5, "name": "Michael Brown", "email": "mbrown@toktickit.com", "role": "IT_STAFF", "isActive": true }
]
```
**Response 403** — caller is not Administrator (AC-18).

## 18. POST /api/admin/users — Administrator
**Request body**
```json
{ "name": "Alex Thompson", "email": "alex.thompson@toktickit.com", "role": "IT_STAFF", "isActive": true, "initialPassword": "TempPass1!" }
```
**Response 201** — created user (no `passwordHash` in response), `mustChangePassword: true`.
**Response 409** — duplicate email (BR-29, AC-15):
```json
{ "error": "This email is already in use", "field": "email" }
```
**Response 400** — invalid role value, or `initialPassword` fails the rule check (BR-07).

## 19. PATCH /api/admin/users/:id — Administrator
**Request body** (any subset) `{ "name": "...", "email": "...", "role": "ADMINISTRATOR", "isActive": false }`
**Response 200** — updated user.
**Response 409** — duplicate email; OR would deactivate/change the role of the last active
Administrator (BR-33, AC-17); OR the Administrator is editing their own `isActive` to false
(BR-32):
```json
{ "error": "Cannot deactivate the last active Administrator" }
```
**Response 404** — user does not exist.

## 20. POST /api/admin/users/:id/reset-password — Administrator
**Request body** `{ "newPassword": "TempPass2!" }`
**Response 200** — `{ "success": true, "mustChangePassword": true }` (BR-31, AC-16).
**Response 400** — password fails the rule check (BR-07).
**Response 404** — user does not exist.

## 21. HTTP Status Code Summary

| Status | Used for |
|---|---|
| 200 | Successful retrieval / update / logout / password change |
| 201 | Ticket/Comment/Note/User created |
| 400 | Invalid input, invalid status transition, weak password |
| 401 | Missing/invalid/expired session, or wrong login credentials |
| 403 | Authenticated but forbidden by role/ownership, or password-change pending |
| 404 | Ticket, Attachment, User, or Note does not exist |
| 409 | Duplicate email, self-deactivation, last-Administrator removal, unassigned-ticket resolve, invalid double-confirmation |
| 410 | Attachment exists but was soft-removed (unchanged from Lab 2) |
| 500 | Unexpected server error (always a safe generic message) |

Every 403 and 404 response uses an identical generic shape regardless of the
underlying reason, so a caller cannot distinguish "forbidden" from
"does not exist" for another user's protected resource (BR-10, Section 6.2
of the handout).
