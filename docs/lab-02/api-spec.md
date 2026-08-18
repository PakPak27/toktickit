# Lab 2 API Contract

All Requester-scoped endpoints require header `X-Requester-Id: <int>` (stand-in for a
real session per BR-05/BR-10/Assumption in specification.md). The backend re-validates
that every resource belongs to that `requesterId` on every read and write — the header is
never trusted as authentication, only as the testing-context identifier.

## 1. GET /api/requesters
List active Development Requesters (for the selector).

**Response 200**
```json
[
  { "id": 1, "name": "Jennifer Anderson", "email": "jennifer.anderson@example.com" },
  { "id": 2, "name": "Michael Brown", "email": "michael.brown@example.com" }
]
```
Inactive Requesters are excluded (BR-06). Empty array `[]` if none active.

**Response 500** — safe error, no internal details:
```json
{ "error": "Unable to load requesters" }
```

## 2. GET /api/categories
Reused from Lab 1, unchanged. Returns active Categories: `[{ "id": 1, "name": "Hardware" }, ...]`.

## 3. GET /api/related-systems
**Response 200**
```json
[
  { "id": 1, "name": "Email" },
  { "id": 2, "name": "Campus Wi-Fi" }
]
```
Only `isActive: true` records returned.

## 4. POST /api/tickets
Create a Ticket for the current Requester (from `X-Requester-Id`).

**Request body**
```json
{
  "categoryId": 2,
  "relatedSystemId": 1,
  "summary": "Laptop battery drains quickly",
  "description": "My laptop battery is draining much faster than usual...",
  "requestedPriority": "MEDIUM"
}
```

**Response 201**
```json
{
  "id": 42,
  "ticketNumber": "TKT-2026-000042",
  "requesterId": 3,
  "categoryId": 2,
  "relatedSystemId": 1,
  "summary": "Laptop battery drains quickly",
  "description": "My laptop battery is draining much faster than usual...",
  "requestedPriority": "MEDIUM",
  "itPriority": null,
  "currentStatus": "NEW",
  "createdAt": "2026-08-18T10:15:00.000Z",
  "updatedAt": "2026-08-18T10:15:00.000Z"
}
```

**Response 400** — validation failure (BR-15/16/17/18):
```json
{
  "error": "Validation failed",
  "fields": {
    "summary": "Summary must be between 5 and 120 characters",
    "categoryId": "Category is required"
  }
}
```

**Response 400** — missing/invalid `X-Requester-Id`, or Requester not active:
```json
{ "error": "A valid, active requester is required" }
```

**Response 500** — safe unexpected error:
```json
{ "error": "Unable to create ticket" }
```

## 5. GET /api/tickets
Paginated, searchable, filterable, sortable list of the current Requester's own tickets.

**Query parameters**

| Param | Type | Default | Notes |
|---|---|---|---|
| `search` | string | — | matches ticketNumber or summary (BR-12) |
| `categoryId` | int | — | filter |
| `requestedPriority` | LOW/MEDIUM/HIGH | — | filter |
| `itPriority` | LOW/MEDIUM/HIGH | — | filter |
| `currentStatus` | string | — | filter |
| `sort` | createdAt/ticketNumber/updatedAt | `createdAt` | BR-13 |
| `order` | asc/desc | `desc` | BR-13 |
| `page` | int | `1` | 1-indexed |
| `pageSize` | 10/20/50 | `10` | BR-13 |

Invalid values for `sort`/`order`/`pageSize` fall back to defaults silently (BR-14).

**Response 200**
```json
{
  "data": [
    {
      "id": 42,
      "ticketNumber": "TKT-2026-000042",
      "summary": "Laptop battery drains quickly",
      "categoryId": 2,
      "requestedPriority": "MEDIUM",
      "itPriority": null,
      "currentStatus": "NEW",
      "createdAt": "2026-08-18T10:15:00.000Z",
      "updatedAt": "2026-08-18T10:15:00.000Z"
    }
  ],
  "pagination": { "page": 1, "pageSize": 10, "totalItems": 1, "totalPages": 1 }
}
```
Empty `data: []` with `totalItems: 0` covers both the Empty state (BR-30, no search/filter
active) and No Results state (BR-31, search/filter active) — the frontend distinguishes
which message to show based on whether any search/filter params were sent (see `ui-spec.md`
Section 15).

## 6. GET /api/tickets/:id
Retrieve one owned Ticket with attachment summary.

**Response 200**
```json
{
  "id": 42,
  "ticketNumber": "TKT-2026-000042",
  "requesterId": 3,
  "category": { "id": 2, "name": "Hardware" },
  "relatedSystem": { "id": 1, "name": "Corporate Laptop" },
  "summary": "Laptop battery drains quickly",
  "description": "My laptop battery is draining much faster than usual...",
  "requestedPriority": "MEDIUM",
  "itPriority": null,
  "currentStatus": "NEW",
  "createdAt": "2026-08-18T10:15:00.000Z",
  "updatedAt": "2026-08-18T10:15:00.000Z",
  "attachments": [
    {
      "id": 7,
      "fileName": "battery-report.pdf",
      "sizeBytes": 245678,
      "mimeType": "application/pdf",
      "uploadedAt": "2026-08-18T10:16:00.000Z",
      "removedAt": null,
      "removalReason": null
    }
  ]
}
```

**Response 403** — ticket exists but belongs to a different requesterId (AC-03/BR-11):
```json
{ "error": "You do not have access to this ticket" }
```

**Response 404** — ticket does not exist:
```json
{ "error": "Ticket not found" }
```

## 7. POST /api/tickets/:id/attachments
Upload an Attachment to an owned Ticket. `multipart/form-data`, field name `file`.

**Response 201**
```json
{
  "id": 8,
  "ticketId": 42,
  "fileName": "screenshot.png",
  "sizeBytes": 184320,
  "mimeType": "image/png",
  "uploadedAt": "2026-08-18T10:20:00.000Z",
  "removedAt": null,
  "removalReason": null
}
```

**Response 400** — invalid type (BR-22):
```json
{ "error": "File type not supported. Allowed: JPG, JPEG, PNG, WEBP, PDF" }
```

**Response 400** — too large (BR-23):
```json
{ "error": "File exceeds the 5MB size limit" }
```

**Response 409** — active-attachment limit reached (BR-24):
```json
{ "error": "This ticket already has the maximum of 5 active attachments" }
```

**Response 403** — ticket not owned by current Requester.

## 8. GET /api/tickets/:id/attachments
List Attachment metadata (active + removed) for an owned Ticket. Same shape as the
`attachments` array in `GET /api/tickets/:id`.

## 9. GET /api/attachments/:id/download
Download an active Attachment (ownership-checked via its parent Ticket's `requesterId`).

**Response 200** — binary file stream, `Content-Disposition: attachment; filename="..."`.

**Response 403** — attachment's ticket not owned by current Requester:
```json
{ "error": "You do not have access to this attachment" }
```

**Response 410** — attachment exists but has been soft-removed (BR-26, AC-10):
```json
{ "error": "This attachment has been removed and is no longer available" }
```

**Response 404** — attachment does not exist.

## 10. DELETE /api/attachments/:id
Soft-remove an active Attachment.

**Request body**
```json
{ "reason": "Uploaded the wrong file, replacing with the correct report." }
```

**Response 200**
```json
{
  "id": 8,
  "removedAt": "2026-08-18T10:25:00.000Z",
  "removalReason": "Uploaded the wrong file, replacing with the correct report."
}
```

**Response 400** — missing/too-short reason (BR-28):
```json
{ "error": "A removal reason of at least 3 characters is required" }
```

**Response 403** — not owned, or already removed (idempotency guard — cannot re-remove).

## 11. HTTP Status Code Summary

| Status | Used for |
|---|---|
| 200 | Successful retrieval / successful soft-remove |
| 201 | Ticket created / Attachment uploaded |
| 400 | Invalid input, invalid file type, oversized file, missing removal reason |
| 403 | Ownership failure (ticket/attachment not owned by current Requester) |
| 404 | Ticket or Attachment does not exist |
| 409 | Active-attachment limit reached |
| 410 | Attachment exists but was soft-removed (download/preview blocked) |
| 500 | Unexpected server error (always a safe generic message, never a stack trace) |