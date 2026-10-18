# Lab 4 Sprint Engineering Specification

## 1. Sprint Goal
Complete the core TokTickIT service-desk workflow: IT Staff and Administrators
record Actions Taken against a Ticket (the actual work log, separate from
Public Comments and Internal Notes), the Ticket resolution rule is backend-
enforced against that work log, Requesters and IT Staff get a concise
role-appropriate dashboard, and the full Labs 1–3 application is regression-
tested and hardened for final demonstration.

## 2. Stakeholder Request Interpretation
IT Staff can already talk to Requesters (Public Comments) and privately among
themselves (Internal Notes), but neither of those is a structured record of
what was actually *done* to a Ticket. Actions Taken is that record: one or
more dated entries per Ticket, each with a description, a result, whether
follow-up is still needed, and (optionally) a note about where to find
related evidence. Any IT Staff or Administrator may add or edit an Action
Taken on a Ticket they can access — not only the Ticket Owner — because the
Owner coordinates the Ticket, but the work itself is often done by whoever
picks it up. A Ticket can only be formally Resolved once that work log shows
nothing is still outstanding; a Requester's "problem appears resolved" signal
remains advisory only, never a resolution by itself. Dashboards exist so a
Requester or an IT Staff member can see what matters today without opening
My Tickets/the Ticket Queue and manually scanning — but they are a summary
view backed by the same data, not a second source of truth.

## 3. Scope

### Included
- `ActionTaken` record per Ticket: date/time (server-set), description,
  result, performer (session-derived), follow-up required flag, follow-up
  note (conditionally required), attachment notes (free text hint)
- Create and edit Actions Taken (IT Staff/Administrator, any accessible
  Ticket — not Owner-restricted)
- Resolution gate: `RESOLVED` is rejected server-side while any open
  follow-up remains, independent of what the UI shows
- Optimistic-concurrency protection on Action Taken edits and Ticket status
  changes (stale-update detection via `updatedAt`)
- Requester Dashboard: own-Ticket metrics, recent/attention-needed Tickets,
  drill-down into My Tickets
- IT Staff/Administrator Dashboard: queue-wide status/ownership metrics,
  recent Tickets, drill-down into the Ticket Queue
- Final hardening: full Labs 1–3 regression pass, duplicate-submit
  protection, accessibility/visual consistency, dead-code/console-error
  cleanup, README refresh

### Excluded (per labsheet §4.2)
- SLA clocks, escalation engines, on-call scheduling, breach notifications
- Email/SMS/LINE/push notifications
- Inventory, spare-parts, purchasing, cost/labor accounting
- Multi-level approval workflows, electronic signatures
- Custom report builders, BI tooling, data export/warehouses
- Multi-tenant orgs, production-scale cloud operations
- Deleting an Action Taken (create/edit only, matching the append-style
  audit intent of the rest of the Ticket record)
- File upload on Actions Taken — "Attachment Notes" is a text hint pointing
  at an existing Lab 2 Attachment, not a new upload mechanism

## 4. Functional Requirements
- FR-01: The system shall allow IT Staff/Administrator to create an Action
  Taken on any Ticket they are permitted to view.
- FR-02: The system shall allow IT Staff/Administrator to edit an existing
  Action Taken's description, result, follow-up fields, and attachment
  notes, regardless of which staff member originally created it.
- FR-03: The system shall record the performer of every Action Taken from
  the authenticated session, never from client input.
- FR-04: The system shall require Follow-up Note whenever Follow-Up Required
  is true, and shall clear/ignore it when false.
- FR-05: The system shall show Actions Taken to the owning Requester on
  their Ticket Detail screen, read-only.
- FR-06: The system shall reject a Ticket status change to `RESOLVED` while
  any Action Taken on that Ticket has Follow-Up Required = true.
- FR-07: The system shall reject a stale Action Taken edit or Ticket status
  change when the record has been modified since the client last read it.
- FR-08: The system shall provide a Requester Dashboard summarizing only
  that Requester's own Tickets.
- FR-09: The system shall provide an IT Staff/Administrator Dashboard
  summarizing Tickets across all Requesters.
- FR-10: The system shall calculate every dashboard metric from live
  database queries, never from client-supplied or cached values.
- FR-11: The system shall link every dashboard metric/list item to the
  corresponding filtered Ticket Queue or My Tickets view.
- FR-12: The system shall continue to enforce every Lab 2/Lab 3 requirement
  (authentication, role authorization, ownership, comments, notes,
  attachments, user management) unchanged.
- FR-13: The system shall prevent a duplicate Action Taken or status change
  from a double-click or network retry from being applied twice.

## 5. Business Rules

### Actions Taken
- BR-01: An Action Taken belongs to exactly one Ticket (`ticketId`, required,
  immutable after creation).
- BR-02: The Ticket Owner coordinates the Ticket as a whole, but any active
  IT Staff/Administrator may create or edit an Action Taken on a Ticket they
  can access — Actions Taken are not restricted to the current Owner.
- BR-03: `performedById` is set once at creation from the session and is
  never changed by an edit (an edit changes the content of the entry, not
  who originally logged it).
- BR-04: `actionDateTime` is server-set at creation (`createdAt`) and is not
  client-editable; edits update `updatedAt` only.
- BR-05: Description and Result are each required, trimmed, 1–2000
  characters (same bound as Public Comments/Internal Notes, BR-31 of
  `docs/lab-03/specification.md`).
- BR-06: Follow-Up Required is a required boolean. Follow-up Note is
  required, trimmed, 1–1000 characters when Follow-Up Required is true; it
  is cleared (stored as null) when Follow-Up Required is false, so a stale
  note can never be mistaken for a current one.
- BR-07: Attachment Notes is optional free text (0–500 characters) — a hint
  toward where to find related evidence (e.g. an existing Lab 2 Attachment
  filename), not a file upload field.
- BR-08: Only IT Staff/Administrator may create or edit an Action Taken; a
  Requester is rejected with 403 even on their own Ticket (FR-05 covers
  their read access separately).
- BR-09: Actions Taken are never deleted; only create and edit are
  supported (FR-02), matching the rest of the Ticket record's audit intent.

### Ticket status, resolution, and concurrency
- BR-10: The status-transition matrix carried forward from
  `docs/lab-03/specification.md` §5.5 remains unchanged by role/transition
  shape; Lab 4 adds one new gate (BR-11) on top of it.
- BR-11: A Ticket cannot transition to `RESOLVED` while any Action Taken on
  it has Follow-Up Required = true — the deferred rule from Lab 3's BR-25.
  The gate is enforced in the same backend handler as the status-transition
  matrix, so it cannot be bypassed by calling the API directly.
- BR-12: `RESOLVED` still additionally requires the Ticket to have a Ticket
  Owner (Lab 3 BR-19, carried forward unchanged) and, new in Lab 4, at least
  one Action Taken — a Ticket cannot be marked Resolved with no recorded
  work at all.
- BR-13: An Action Taken edit (`PATCH`) must include the `updatedAt` value
  the client last read; if it no longer matches the stored value, the
  request is rejected with `409 Conflict` and the current record, rather
  than silently overwriting a newer edit.
- BR-14: A Ticket status change (`PATCH .../status`) must include the
  `updatedAt` value the client last read, with the same `409 Conflict`
  behavior as BR-13 — protects against two IT Staff racing to transition the
  same Ticket from stale UI state.
- BR-15: A client-visible idempotency key (or, where the UI can guarantee
  it, button-disable-on-submit) prevents a duplicate Action Taken from a
  double-click or retried request from being created twice (FR-13).

### Dashboards
- BR-16: Requester Dashboard metrics are scoped to `requesterId = session
  user id` only — never any other Requester's Tickets, enforced the same
  way as My Tickets (Lab 2 BR-10/Lab 3 BR-09).
- BR-17: IT Staff/Administrator Dashboard metrics are computed across all
  Tickets (not scoped to the viewer), consistent with the Ticket Queue's own
  scope.
- BR-18: Every dashboard metric is calculated by a live backend query at
  request time; nothing is pre-aggregated, cached, or client-computed.
- BR-19: "Recent" lists are the most-recently-updated N Tickets in the
  relevant scope (default N = 5), ordered by `updatedAt` descending — not a
  calendar-day or timezone-bound window, which is out of scope per the
  labsheet's SLA-clock exclusion.
- BR-20: Every dashboard count/list that can legitimately be zero (e.g. no
  unassigned Tickets) renders an explicit "0"/empty state, never a blank or
  broken card.

## 6. UI Specification Summary
Full detail lives in `ui-spec.md`. Summary:
- **IT Staff Ticket Detail — Actions Taken panel:** a new tab/section
  alongside Public Comments/Internal Notes/Attachments — a list (newest
  first), an "Add Action Taken" form (create mode), and an inline Edit
  action per row (view/edit mode). Follow-up Note only appears/becomes
  required when Follow-Up Required is checked.
- **Requester Ticket Detail:** Actions Taken shown read-only, same list
  presentation, no create/edit controls.
- **Ticket status control:** unchanged mechanism from Lab 3 (only
  matrix-valid next statuses offered), now also hides/disables `RESOLVED`
  client-side when an open follow-up exists, with the backend as the actual
  authority (BR-11) if that hint is ever stale or bypassed.
- **IT Staff/Administrator Dashboard:** new default landing screen for
  those roles — metric cards (New/Open/In Progress/Waiting for
  Requester/Unassigned/My Assigned), a short "Recent Tickets" list, each
  card/row linking into the Ticket Queue pre-filtered.
- **Requester Dashboard:** new default landing screen for Requesters —
  metric cards (Open/In Progress/Resolved/Closed, Waiting for Requester),
  a short "Recent Tickets" list, each linking into My Tickets pre-filtered.
- **Navigation:** "Dashboard" replaces the bare role-based `HomeRedirect`
  destination for authenticated users; Administrators keep their existing
  "Users" link alongside it.

## 7. Data Changes

### ActionTaken (new)
| Field | Type | Notes |
|---|---|---|
| id | Int (PK, autoincrement) | |
| ticketId | Int (FK → Ticket) | indexed; immutable after creation (BR-01) |
| performedById | Int (FK → User, role IT_STAFF/ADMINISTRATOR) | from session at creation only (BR-03) |
| description | String (Text) | required, trimmed, 1–2000 chars |
| result | String (Text) | required, trimmed, 1–2000 chars |
| followUpRequired | Boolean | required, default false |
| followUpNote | String (Text), nullable | required when followUpRequired=true; null otherwise (BR-06) |
| attachmentNotes | String, nullable | optional, 0–500 chars |
| createdAt | DateTime | default now(); the Action's date/time (BR-04) |
| updatedAt | DateTime | @updatedAt; drives optimistic concurrency (BR-13) |

### Indexes / constraints
- `ActionTaken.ticketId` — index (list-by-ticket is the only query pattern)
- `ActionTaken.followUpRequired` — index (resolution-gate lookup, BR-11)

### Migration strategy
1. Add the `ActionTaken` table (new; no existing data affected).
2. No backfill is needed — a Ticket legacy or new with zero Actions Taken
   is valid and simply cannot yet reach `RESOLVED` (BR-12); this is already
   true today since nothing has an Action Taken before this migration runs.
3. All existing User/Ticket/Attachment/PublicComment/InternalNote data is
   preserved untouched; no destructive step.
4. Seed script (idempotent, matching the Lab 3 pattern) adds Actions Taken
   to a subset of seeded Tickets: some with zero, some with one, some with
   several, and at least one with an open `followUpRequired = true` entry
   on a Ticket that is therefore demonstrably blocked from `RESOLVED` —
   required by labsheet §5.3.

## 8. API Contract
Full request/response bodies live in `api-spec.md`. Summary of new/changed
endpoints:

| Method | Path | Purpose | Roles |
|---|---|---|---|
| GET | /api/staff/tickets/:id/actions | List Actions Taken for a Ticket | IT Staff, Administrator |
| POST | /api/staff/tickets/:id/actions | Create an Action Taken | IT Staff, Administrator |
| PATCH | /api/staff/tickets/:id/actions/:actionId | Edit an Action Taken (optimistic-concurrency checked) | IT Staff, Administrator |
| GET | /api/tickets/:id/actions | List Actions Taken, read-only | Requester (own Ticket) |
| GET | /api/dashboard/requester | Requester Dashboard metrics + recent Tickets | Requester |
| GET | /api/dashboard/staff | IT Staff/Administrator Dashboard metrics + recent Tickets | IT Staff, Administrator |

`PATCH /api/staff/tickets/:id/status` (existing, Lab 3) gains: the BR-11/
BR-12 resolution gate, and the BR-14 `updatedAt` concurrency check (new
required request field, new `409 CONFLICT` response case).

## 9. Acceptance Criteria
- AC-01: Given a permitted IT Staff user and valid data, when an Action
  Taken is created, then it is saved under the correct Ticket with the
  authenticated creator and appears in the list immediately.
- AC-02: Given an Action Taken created by IT Staff member A, when IT Staff
  member B edits it, then the edit succeeds and `performedById` still shows
  A (the original creator), while `updatedAt` changes.
- AC-03: Given Follow-Up Required is checked, when the form is submitted
  without a Follow-up Note, then the request is rejected and no record is
  created/changed.
- AC-04: Given a Ticket with an Action Taken whose Follow-Up Required is
  true, when IT Staff attempts to set status to `RESOLVED`, then the request
  is rejected (409) even though the raw status transition would otherwise be
  valid per the matrix.
- AC-05: Given a Ticket with zero Actions Taken, when IT Staff attempts to
  set status to `RESOLVED`, then the request is rejected (409).
- AC-06: Given a Ticket whose only open follow-up is then resolved by
  editing that Action Taken's Follow-Up Required to false, when IT Staff
  retries the `RESOLVED` transition, then it now succeeds.
- AC-07: Given two IT Staff viewing the same Action Taken, when the first
  saves an edit and the second then submits an edit based on the
  now-stale `updatedAt`, then the second request is rejected (409) with the
  current record returned, not silently overwritten.
- AC-08: Given a Requester views their own Ticket Detail, when Actions
  Taken exist, then they are shown read-only with no create/edit controls
  visible, and a direct API call to create/edit one is rejected (403).
- AC-09: Given an authenticated Requester, when the Requester Dashboard is
  requested, then only metrics and recent Tickets owned by that Requester
  are returned.
- AC-10: Given an authenticated IT Staff user, when the Staff Dashboard is
  requested, then metrics reflect Tickets across all Requesters, including
  an accurate unassigned count and the viewer's own assigned count.
- AC-11: Given zero Tickets match a given dashboard metric, when the
  dashboard is viewed, then that card/list shows an explicit empty/zero
  state, not a blank area or error.
- AC-12: Given a dashboard metric card, when it is clicked, then the Ticket
  Queue/My Tickets screen opens pre-filtered to match that metric's
  definition.
- AC-13: Given the full Lab 2/Lab 3 regression suite, when it is re-run on
  the Lab 4 branch, then every existing acceptance criterion still passes
  unmodified.
- AC-14: Given a double-click or retried submit on Create Action Taken or a
  status change, when the duplicate request arrives, then only one record/
  change is ultimately applied.

## 10. Definition of Done
- [ ] All FRs, BRs, and ACs above are implemented and satisfied
- [ ] All planned tests in `tests.md` pass, traced to specific AC IDs
- [ ] No required test is skipped, disabled, or commented out
- [ ] Full Lab 2 + Lab 3 regression suites pass unmodified on the Lab 4
      branch
- [ ] Data model matches this document and the Prisma schema; migration
      adds `ActionTaken` without discarding any existing data
- [ ] All API responses match `api-spec.md` (status codes, shapes, error
      cases), including the new 409 Conflict cases
- [ ] Every protected/gated backend operation (Action Taken write, the
      resolution gate, concurrency checks) is enforced independently of the
      frontend (verified by direct API tests bypassing the UI)
- [ ] UI matches `ui-spec.md` (Zen Green tokens, states, responsive rules,
      dashboard drill-down)
- [ ] Dashboard metrics are verified against direct database queries, not
      just visual plausibility
- [ ] Playwright screenshots exist for desktop/tablet/mobile for the
      Requester Dashboard, Staff Dashboard, and Actions Taken panel
- [ ] README setup/test/demo instructions are current for Lab 4
- [ ] Peer review approved on every Issue's PR into `lab4-staging`
- [ ] `lab4-staging` merged into `main` via a single release PR

## 11. Assumptions and Decisions
- **Result is free text, not an enum:** the labsheet lists "Result" as a
  field without specifying permitted values, unlike Priority/Status
  elsewhere; a short required free-text field (same bound as Description)
  keeps this flexible without inventing an unapproved enum.
- **Resolution gate definition:** interpreted as "no Action Taken on the
  Ticket currently has Follow-Up Required = true" plus "at least one Action
  Taken exists" (BR-11/BR-12) — the most literal reading of "Follow-Up
  Required" as a live pending-work flag, and directly testable. An
  IT Staff member clears a stale follow-up by editing that Action Taken
  (FR-02 exists specifically to make this possible) rather than needing a
  separate "resolve follow-up" action.
- **Optimistic concurrency via `updatedAt` echo**, not a dedicated version
  column — reuses a field every record already has from Lab 2/3, keeps the
  client contract simple (send back what you read), and is sufficient for
  this course's human-paced editing (not a high-contention system).
- **Actions Taken are edit-anyone, not edit-own-only:** per labsheet §4.3
  ("IT Staff: Create and update Action Taken on accessible Tickets", not
  "their own"), and consistent with claim/reassign already being a shared
  staff responsibility in Lab 3.
- **Dashboard "recent" is row-count-bounded, not time-bounded:** avoids
  timezone/date-boundary complexity explicitly out of scope (no SLA
  clocks), while still satisfying "recently updated" via `updatedAt DESC`
  ordering.
- **Administrator Dashboard reuses the Staff Dashboard** (`/api/dashboard/
  staff`, role-gated to both IT_STAFF and ADMINISTRATOR) rather than a
  third endpoint, per the labsheet's explicit "may reuse" allowance; no
  extra user-account counts are added in Lab 4 (optional per labsheet, and
  User Management's own list already serves that need).
