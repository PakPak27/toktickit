# Lab 3 Sprint Engineering Specification

## 1. Sprint Goal
Replace the temporary Development Requester selector with real email/password
authentication and server-enforced role-based authorization for three roles —
Requester, IT Staff, and Administrator — without breaking any Lab 2 Requester
ticketing function. Deliver an operational IT Staff Ticket Queue and Ticket
Detail workflow (claim/reassign ownership, IT Priority, status transitions,
Public Comments, Internal Notes) and a minimalist Administrator User
Management screen, all on the existing Zen Green UI foundation.

## 2. Stakeholder Request Interpretation
The Development Requester selector was only ever a stand-in for real login.
The IT department now needs actual accounts: every user signs in with an
email and password, and a user issued a temporary password must change it
before doing anything else. Once signed in, a Requester keeps using the Lab 2
ticket features exactly as before, except their identity now comes from their
authenticated session instead of a client-supplied `requesterId`. IT Staff get
a shared queue of all tickets so they can find work, take ownership, set IT
Priority, move a ticket through its permitted statuses, and talk to the
Requester (Public Comments) or each other (Internal Notes, hidden from the
Requester). Requesters can say a problem looks fixed, but only IT Staff can
formally resolve or close a ticket. Administrators get one simple screen to
create/edit accounts, assign a role, (de)activate users, and reset a
password — nothing more. Every one of these rules is enforced on the backend;
a disabled button on the frontend is a convenience, not security.

## 3. Scope

### Included
- Email/password login, logout, current-user retrieval
- Mandatory password change on first login (`mustChangePassword` flag)
- Server-side role-based authorization for Requester, IT Staff, Administrator
- Migration of Lab 2 `RequesterUser` records into the new `User` model
- Continued operation of all Lab 2 Requester ticket/attachment functions
  under the authenticated identity (no more `X-Requester-Id` header)
- Requester: Public Comments on own tickets, "Problem Appears Resolved" flag
- IT Staff: Ticket Queue (search/filter/sort/paginate), Ticket Detail,
  claim/reassign ownership, IT Priority, permitted status transitions,
  Public Comments, Internal Notes
- Administrator: minimalist User Management (list/search/filter, create,
  edit, activate/deactivate, set new initial password)
- Zen Green application shell updates: authenticated user/role display,
  logout, role-specific navigation

### Excluded
- Password-reset email, email invitations, MFA, social login, SSO
- Self-registration / Requester-created accounts
- Actions Taken (deferred to Lab 4)
- SLA calculation, escalation, notification services, dashboards/KPIs
- Multi-tenant orgs/departments; multiple roles per user
- User deletion, bulk user ops, import/export, account-history/audit screens
- Editing or deleting Public Comments / Internal Notes (append-only)
- Pagination, multi-column sort, or multiple simultaneous filters on the
  Administrator user list

## 4. Functional Requirements
- FR-01: The system shall authenticate a user by email and password and
  establish an authenticated session (httpOnly cookie).
- FR-02: The system shall reject authentication for inactive accounts or
  incorrect credentials with one generic, non-revealing error message.
- FR-03: The system shall force any user with `mustChangePassword = true`
  into a Change Password screen before any other screen is reachable.
- FR-04: The system shall expose the current authenticated user (id, name,
  email, role) to the frontend via a "current user" endpoint.
- FR-05: The system shall allow an authenticated user to log out, invalidating
  their session.
- FR-06: The system shall determine Requester ownership from the authenticated
  session, never from a client-supplied identifier.
- FR-07: The system shall continue to support Create Ticket, My Tickets,
  Requester Ticket Detail, and Attachment add/download/soft-remove for the
  authenticated Requester, unchanged in behavior from Lab 2.
- FR-08: The system shall allow a Requester to add a Public Comment to their
  own Ticket.
- FR-09: The system shall allow a Requester to mark a Ticket as
  "problem appears resolved" without changing its formal Current Status.
- FR-10: The system shall provide IT Staff a Ticket Queue listing all Tickets
  with search, filtering, sorting, and pagination.
- FR-11: The system shall allow IT Staff to open any Ticket's detail screen.
- FR-12: The system shall allow IT Staff to claim an unassigned Ticket or
  reassign an already-owned Ticket to another active IT Staff/Administrator.
- FR-13: The system shall allow IT Staff/Administrator to set IT Priority on
  a Ticket, independent of Requested Priority.
- FR-14: The system shall allow IT Staff/Administrator to change Current
  Status according to the permitted status-transition matrix (Section 5.5).
- FR-15: The system shall allow IT Staff/Administrator to add a Public
  Comment or an Internal Note to a Ticket.
- FR-16: The system shall show Public Comments to Requester, IT Staff, and
  Administrator, and Internal Notes only to IT Staff and Administrator.
- FR-17: The system shall allow an Administrator to list, search (name or
  email), and optionally filter (role) user accounts.
- FR-18: The system shall allow an Administrator to create a user with name,
  email, one role, activation state, and an initial password.
- FR-19: The system shall allow an Administrator to edit a user's name,
  email, role, and activation state.
- FR-20: The system shall allow an Administrator to set a new initial
  password for a user, forcing `mustChangePassword = true`.
- FR-21: The system shall prevent an Administrator from deactivating their
  own account or removing the last active Administrator.
- FR-22: The system shall reject every protected request that is
  unauthenticated (401) or authenticated but not permitted for the caller's
  role/ownership (403), without leaking whether the target resource exists.

## 5. Business Rules

### Authentication & sessions
- BR-01: Only an active user (`isActive = true`) with a correct email/password
  combination may authenticate; inactive accounts receive the same generic
  "invalid email or password" message as a wrong password (no account-status
  leak).
- BR-02: Passwords are never stored or logged in plaintext; only a bcrypt
  hash (`passwordHash`) is persisted.
- BR-03: A successful login sets a signed, httpOnly, `SameSite=Lax` JWT
  cookie (`toktickit_session`) containing the user id and role; the token is
  never exposed to client-side JavaScript or committed to source control.
- BR-04: The session cookie expires after 8 hours of issuance; there is no
  refresh mechanism in Lab 3 — the user must log in again after expiry.
- BR-05: Logout clears the session cookie server-side; the cleared cookie is
  immediately rejected by every protected endpoint.
- BR-06: A user with `mustChangePassword = true` may only call the login,
  current-user, change-password, and logout endpoints; every other protected
  endpoint returns 403 until the password is changed.
- BR-07: A new password must be 8+ characters and include at least one
  uppercase letter, one lowercase letter, one digit, and one special
  character; it cannot equal the current password.
- BR-08: On successful password change, `mustChangePassword` is cleared and
  the existing session remains valid (no forced re-login).

### Ownership & authorization
- BR-09: The authenticated user's id from the session — never a client-
  supplied `requesterId`/`userId` — determines Requester ownership on every
  Ticket/Attachment read or write (carried over and now enforced from Lab 2's
  BR-10).
- BR-10: A Requester may only view or modify Tickets and Attachments they own;
  attempting another Requester's resource returns 403/404 without revealing
  its existence.
- BR-11: Only IT Staff and Administrator roles may access the Ticket Queue,
  claim/reassign ownership, set IT Priority, change status beyond what a
  Requester is permitted, or read/write Internal Notes.
- BR-12: Every authorization decision is enforced in backend middleware; the
  frontend hiding or disabling a control is a UX convenience only.

### Requester regression (Lab 2 carryover)
- BR-13: All Lab 2 Requester business rules (BR-01–BR-32 in
  `docs/lab-02/specification.md`) remain in force except where explicitly
  superseded above — e.g., the Development Requester selector (Lab 2 BR-05
  through BR-08, BR-33) is removed and replaced by authenticated identity.

### Ticket ownership, IT Priority, status
- BR-14: A Ticket has at most one Ticket Owner (`ticketOwnerId`), who must be
  an active User with role IT_STAFF or ADMINISTRATOR; a Ticket may be
  unassigned (`ticketOwnerId = null`).
- BR-15: Any active IT Staff/Administrator may claim an unassigned Ticket,
  which sets themselves as Ticket Owner. Reassignment (owner → a different
  active IT Staff/Administrator) is permitted by any IT Staff/Administrator,
  not only the current owner.
- BR-16: Requested Priority is fixed at ticket-creation time and never
  changes after that. IT Priority initially copies Requested Priority at
  creation and may be changed only by IT Staff/Administrator.
- BR-17: Current Status is one of `NEW, OPEN, IN_PROGRESS,
  WAITING_FOR_REQUESTER, RESOLVED, CLOSED, REOPENED, CANCELLED` and only
  transitions permitted by the matrix in Section 5.5 are accepted; any other
  requested transition returns 400 with the list of currently valid next
  statuses.
- BR-18: Only IT Staff/Administrator may change Current Status; a Requester
  may never set status directly (they use the separate "appears resolved"
  flag, BR-21).
- BR-19: Setting Current Status to `RESOLVED` requires the Ticket to have a
  Ticket Owner; an unassigned Ticket cannot be resolved.
- BR-20: Setting Current Status to `CLOSED` is only permitted from
  `RESOLVED`; only IT Staff/Administrator may close a Ticket.

### Requester "appears resolved" indication
- BR-21: A Requester may set `requesterConfirmedResolved = true` (with a
  server timestamp) on their own Ticket at any time the Ticket is not
  already `CLOSED` or `CANCELLED`; this never changes Current Status — it is
  a signal for IT Staff, who remain responsible for formally resolving or
  closing the Ticket (per the stakeholder request and BR-05 of the handout).
- BR-22: If IT Staff reopen a resolved/closed Ticket (`REOPENED`),
  `requesterConfirmedResolved` is reset to `false`.

### Public Comments & Internal Notes
- BR-23: Public Comments are visible to the Requester who owns the Ticket,
  and to any IT Staff/Administrator; Internal Notes are visible only to IT
  Staff/Administrator.
- BR-24: Both Public Comments and Internal Notes are append-only in Lab 3 —
  no edit or delete endpoint exists.
- BR-25: Every Comment/Note records its author (from the session, not client
  input) and a server-generated timestamp.
- BR-26: Comment/Note content is required after trimming, 1–2000 characters;
  whitespace-only content is rejected with a validation error.
- BR-27: A Requester may only post Public Comments (never Internal Notes) and
  only on a Ticket they own.

### Administrator rules
- BR-28: An Administrator may create a user with exactly one role
  (`REQUESTER`, `IT_STAFF`, or `ADMINISTRATOR`), a name, a unique email, an
  activation state, and a system- or admin-supplied initial password; the
  new account has `mustChangePassword = true`.
- BR-29: Email addresses are unique (case-insensitive) across all users;
  creating or editing a user with a duplicate email returns 409.
- BR-30: An Administrator may edit a user's name, email, role, and activation
  state, but not their password directly (see BR-31).
- BR-31: An Administrator may set a new initial password for any user, which
  immediately sets `mustChangePassword = true` for that user and invalidates
  nothing else about their account.
- BR-32: An Administrator cannot deactivate their own account.
- BR-33: The system must always have at least one active Administrator; a
  request that would deactivate or change the role of the last active
  Administrator is rejected with 409.
- BR-34: User accounts are deactivated, never deleted; a deactivated user
  fails login (BR-01) but their historical Tickets, Comments, Notes, and
  ownership remain intact and attributed to them.
- BR-35: Role assignment is single-valued; there is no concept of a user
  holding more than one role in Lab 3.

### Migration from Lab 2
- BR-36: Every Lab 2 `RequesterUser` record is migrated into `User` with
  `role = REQUESTER`, preserving `id`, `name`, `email`, `isActive`, and
  `createdAt`, so existing Ticket ownership (`Ticket.requesterId`) continues
  to reference the same row without data loss.
- BR-37: Migrated Requester accounts receive the documented local-dev initial
  password (Section 5.6) and `mustChangePassword = true`; these are seed/dev
  values only and are never committed as production secrets.
- BR-38: The Development Requester selector UI, its React context, and its
  `localStorage` key are removed entirely; no code path may fall back to a
  client-supplied Requester identity.

### 5.5. Status Transition Matrix
| From \ To | OPEN | IN_PROGRESS | WAITING_FOR_REQUESTER | RESOLVED | CLOSED | REOPENED | CANCELLED |
|---|---|---|---|---|---|---|---|
| NEW | ✔ | ✔ | – | – | – | – | ✔ |
| OPEN | – | ✔ | ✔ | ✔* | – | – | ✔ |
| IN_PROGRESS | ✔ | – | ✔ | ✔* | – | – | ✔ |
| WAITING_FOR_REQUESTER | ✔ | ✔ | – | ✔* | – | – | ✔ |
| RESOLVED | – | – | – | – | ✔ | ✔ | – |
| CLOSED | – | – | – | – | – | ✔ | – |
| REOPENED | ✔ | ✔ | ✔ | ✔* | – | – | ✔ |
| CANCELLED | – | – | – | – | – | – | – (terminal) |

`*` requires an assigned Ticket Owner (BR-19). All transitions above are
IT Staff/Administrator-only (BR-18); `CANCELLED` is terminal — reopening a
cancelled ticket is out of scope for Lab 3.

**Claiming/assigning a Ticket Owner (BR-14/BR-15, `PATCH
/api/staff/tickets/:id/owner`) and changing Current Status (this matrix,
`PATCH /api/staff/tickets/:id/status`) are independent operations.**
Claiming an unassigned `NEW` Ticket sets `ticketOwnerId` only and does not
by itself move Current Status to `OPEN` — the IT Staff member makes a
separate, explicit status-transition call when they actually start
working the Ticket. This keeps "who owns it" and "what state it's in"
decoupled, matching BR-14/BR-15 and the owner endpoint's response shape
(`api-spec.md` §12), which never includes `currentStatus`.

### 5.6. Seed / local-dev credentials
All seeded accounts use the same documented local-only initial password
`ChangeMe123!` with `mustChangePassword = true`, stated in `README.md` and
`server/prisma/seed.ts` comments — never a real secret, never reused outside
local development.

## 6. UI Specification Summary
Full detail lives in `ui-spec.md`. Summary:
- **Application shell:** TokTickIT header unchanged in color/typography;
  Development-Requester display and "Change Requester" are replaced by the
  authenticated user's name + role badge and a Logout action; navigation
  items are filtered by role (Requester sees My Tickets/Create Ticket; IT
  Staff sees Ticket Queue; Administrator sees Users) rather than showing
  disabled/greyed links to unauthorized destinations.
- **Login:** centered card, email + password fields, inline validation,
  busy-state Sign In button, one generic safe-failure message.
- **Change Password:** shown in place of the app when `mustChangePassword`
  is true; current(temporary)/new/confirm fields, live rule checklist,
  Continue button, redirects into the app on success.
- **Requester Ticket Detail:** unchanged Lab 2 layout plus a Public Comments
  thread (list + add box) and a "Problem Appears Resolved" action/badge.
- **IT Staff Ticket Queue:** desktop table / mobile card list mirroring the
  My Tickets pattern, with Ticket Owner and IT Priority columns, search,
  filters (Status, Category, IT Priority, Assigned/Unassigned), sorting,
  pagination, and an Open action.
- **IT Staff Ticket Detail:** Lab 2 read-only header plus editable Ticket
  Owner (claim/reassign dropdown), editable IT Priority, editable Current
  Status (constrained to the transition matrix), tabbed/segmented Public
  Comments vs. Internal Notes (visually distinct colors per Section 7 of the
  handout), and existing Attachments (read-only for IT Staff in Lab 3).
- **Administrator User Management:** single screen — search bar, optional
  role filter, table (Name/Email/Role/Status/Edit), a slide-over or modal for
  Create/Edit with role dropdown, activation toggle, and a "Set New Password"
  action; no pagination/multi-sort per the handout's minimalism rule.
- **Responsive:** same desktop ≥992px / tablet 768–991px / mobile <768px
  rules as Lab 2, applied to the two new screens (Queue, User Management).

## 7. Data Changes

### User (replaces/renames Lab 2 `RequesterUser`)
| Field | Type | Notes |
|---|---|---|
| id | Int (PK, autoincrement) | preserved from `RequesterUser.id` on migration |
| name | String | required |
| email | String | unique (case-insensitive), required |
| passwordHash | String | bcrypt hash, never plaintext |
| role | Enum(`REQUESTER`,`IT_STAFF`,`ADMINISTRATOR`) | single-valued |
| isActive | Boolean | default true |
| mustChangePassword | Boolean | default true for seeded/admin-created users |
| createdAt | DateTime | default now() |
| updatedAt | DateTime | @updatedAt |

### Ticket (extended)
| Field | Type | Notes |
|---|---|---|
| requesterId | Int (FK → User, role REQUESTER) | renamed relation target, same column semantics as Lab 2 |
| ticketOwnerId | Int, nullable (FK → User, role IT_STAFF/ADMIN) | **new**; indexed |
| itPriority | Enum(LOW,MEDIUM,HIGH), nullable | **now settable** by IT Staff/Admin (was always null in Lab 2) |
| currentStatus | Enum(NEW,OPEN,IN_PROGRESS,WAITING_FOR_REQUESTER,RESOLVED,CLOSED,REOPENED,CANCELLED) | **enum extended** from Lab 2's `NEW`-only |
| requesterConfirmedResolved | Boolean | **new**; default false |
| requesterConfirmedResolvedAt | DateTime, nullable | **new** |

### PublicComment (new)
| Field | Type | Notes |
|---|---|---|
| id | Int (PK, autoincrement) | |
| ticketId | Int (FK → Ticket) | indexed |
| authorId | Int (FK → User) | from session, not client input |
| content | String (Text) | required, trimmed, 1–2000 chars |
| createdAt | DateTime | default now() |

### InternalNote (new)
| Field | Type | Notes |
|---|---|---|
| id | Int (PK, autoincrement) | |
| ticketId | Int (FK → Ticket) | indexed |
| authorId | Int (FK → User, role IT_STAFF/ADMIN) | from session |
| content | String (Text) | required, trimmed, 1–2000 chars |
| createdAt | DateTime | default now() |

### Indexes / constraints
- `User.email` — unique index (case-insensitive via lowercase-normalized storage)
- `Ticket.ticketOwnerId` — index (Queue filtering by owner)
- `Ticket.currentStatus`, `Ticket.itPriority` — indexes (Queue filtering/sorting)
- `PublicComment.ticketId`, `InternalNote.ticketId` — indexes

### Migration strategy
1. Rename `RequesterUser` model/table to `User`; add `passwordHash`, `role`
   (default `REQUESTER` for the migration step), `mustChangePassword`
   (default `true`), `updatedAt`.
2. Data-migration script sets `passwordHash` for every existing row to the
   bcrypt hash of the documented seed password (Section 5.6).
3. Seed script adds new IT Staff and Administrator `User` rows (role
   `IT_STAFF` / `ADMINISTRATOR`) alongside the migrated Requesters.
4. Add `ticketOwnerId`, `itPriority` (already existed, now writable),
   `currentStatus` enum values, `requesterConfirmedResolved(At)` to `Ticket`.
5. Add `PublicComment` and `InternalNote` tables.
6. All existing Category/RelatedSystem/Ticket/Attachment data is preserved;
   no destructive migration step drops Ticket or Attachment rows.

## 8. API Contract
Full request/response bodies live in `api-spec.md`. Summary of endpoints:

| Method | Path | Purpose | Roles |
|---|---|---|---|
| POST | /api/auth/login | Authenticate, set session cookie | public |
| POST | /api/auth/logout | Clear session cookie | authenticated |
| GET | /api/auth/me | Current user (id, name, email, role, mustChangePassword) | authenticated |
| POST | /api/auth/change-password | Change own password, clears `mustChangePassword` | authenticated |
| POST | /api/tickets | Create a Ticket (owner = session user) | Requester |
| GET | /api/tickets | Own Tickets, paginated/searchable/filterable/sortable | Requester |
| GET | /api/tickets/:id | One owned Ticket | Requester (own) |
| POST/GET/DELETE | /api/tickets/:id/attachments, /api/attachments/:id/* | unchanged from Lab 2 | Requester (own) |
| POST | /api/tickets/:id/comments | Add Public Comment | Requester (own), IT Staff, Administrator |
| POST | /api/tickets/:id/resolved-confirmation | Set "appears resolved" | Requester (own) |
| GET | /api/staff/tickets | Ticket Queue, search/filter/sort/paginate | IT Staff, Administrator |
| GET | /api/staff/tickets/:id | One Ticket for staff operations | IT Staff, Administrator |
| PATCH | /api/staff/tickets/:id/owner | Claim/assign/reassign Ticket Owner | IT Staff, Administrator |
| PATCH | /api/staff/tickets/:id/priority | Set IT Priority | IT Staff, Administrator |
| PATCH | /api/staff/tickets/:id/status | Change Current Status (matrix-checked) | IT Staff, Administrator |
| POST | /api/staff/tickets/:id/notes | Add Internal Note | IT Staff, Administrator |
| GET | /api/admin/users | User list, search by name/email, optional role filter | Administrator |
| POST | /api/admin/users | Create user | Administrator |
| PATCH | /api/admin/users/:id | Edit name/email/role/activation | Administrator |
| POST | /api/admin/users/:id/reset-password | Set new initial password | Administrator |

All previously requester-scoped Lab 2 endpoints drop the `X-Requester-Id`
header entirely; ownership comes from the session cookie only (BR-09).

## 9. Acceptance Criteria
- AC-01: Given an active user with valid credentials, when they log in, then
  the backend sets an authenticated session and returns their id/name/role.
- AC-02: Given an inactive user or wrong password, when login is attempted,
  then a single generic "invalid email or password" error is returned (401)
  with no distinction between the two causes.
- AC-03: Given a user with `mustChangePassword = true`, when login succeeds,
  then every non-auth screen/endpoint remains unavailable until a valid new
  password is saved.
- AC-04: Given an authenticated Requester, when the client sends a different
  `requesterId`/`userId` in the request body, then the backend still uses the
  session identity and never returns another Requester's data.
- AC-05: Given Requester A is logged in, when they request a Ticket owned by
  Requester B by id, then the response is 403/404 with no ticket data.
- AC-06: Given an authenticated Requester, when they call an Internal-Note
  endpoint, then the request is rejected (403) without exposing note content.
- AC-07: Given an unassigned Ticket, when an active IT Staff user claims it,
  then `ticketOwnerId` is set to that user and the Queue reflects the change.
- AC-08: Given a Ticket owned by IT Staff A, when IT Staff B reassigns it to
  themselves, then `ticketOwnerId` updates to B and the change is visible to
  both in the Queue and Ticket Detail.
- AC-09: Given a Ticket in `NEW`, when IT Staff attempts to set status
  directly to `RESOLVED`, then the request is rejected as an invalid
  transition (400) per the matrix in Section 5.5.
- AC-10: Given an unassigned Ticket, when IT Staff attempts to set status to
  `RESOLVED`, then the request is rejected (BR-19) even though the raw status
  transition would otherwise be valid.
- AC-11: Given a Requester views their own Ticket, when they add a Public
  Comment, then it appears in the thread with their name and a server
  timestamp, and is visible to IT Staff on the same Ticket.
- AC-12: Given IT Staff adds an Internal Note, when the Requester views their
  Ticket Detail, then the Internal Note does not appear anywhere in the
  response or DOM.
- AC-13: Given a Requester marks a Ticket "appears resolved", when IT Staff
  views the Ticket, then a visible indicator is shown but Current Status is
  unchanged until IT Staff formally transitions it.
- AC-14: Given 40+ Tickets across multiple statuses/owners, when IT Staff
  searches/filters/sorts/paginates the Queue, then the returned subset and
  ordering match the applied query parameters.
- AC-15: Given an Administrator creates a user with an email that already
  exists, when the form is submitted, then a 409 conflict with a field-level
  message is shown and no duplicate user is created.
- AC-16: Given an Administrator resets a user's password, when that user
  next logs in with the new password, then they are routed to Change
  Password before reaching any other screen.
- AC-17: Given the only active Administrator, when they attempt to deactivate
  their own account or another request would leave zero active
  Administrators, then the request is rejected (409) with an explanatory
  message.
- AC-18: Given a non-Administrator user, when they call any `/api/admin/*`
  endpoint directly, then the response is 403 regardless of frontend routing.
- AC-19: Given a logged-in user, when they log out and then reuse the old
  session cookie, then every protected endpoint returns 401.
- AC-20: Given the Lab 2 regression suite (My Tickets, Create Ticket,
  Attachments), when it is re-run against Lab 3 using an authenticated
  Requester session instead of `X-Requester-Id`, then all Lab 2 acceptance
  criteria still pass unmodified in behavior.

## 10. Definition of Done
- [ ] All FRs, BRs, and ACs above are implemented and satisfied
- [ ] All planned tests in `tests.md` pass, traced to specific AC IDs
- [ ] No required test is skipped, disabled, or commented out
- [ ] Full Lab 2 regression suite passes unmodified under authenticated
      Requester sessions (no `X-Requester-Id` remaining anywhere)
- [ ] Data model matches this document and the Prisma schema; migration from
      `RequesterUser` preserves all existing Ticket/Attachment data
- [ ] All API responses match `api-spec.md` (status codes, shapes, error
      cases), including 401 vs 403 vs 404 distinctions
- [ ] Every protected backend operation is authorization-checked
      independently of the frontend (verified by direct API tests bypassing
      the UI)
- [ ] UI matches `ui-spec.md` (Zen Green tokens, states, responsive rules,
      role-specific navigation)
- [ ] Passwords are hashed (bcrypt); no plaintext password appears in the
      database, logs, or source control
- [ ] Playwright screenshots exist for desktop/tablet/mobile for Login,
      Ticket Queue, IT Staff Ticket Detail, and User Management
- [ ] README setup/test instructions are current for Lab 3, including the
      documented seed credentials
- [ ] Peer review approved on every Issue's PR into `lab3-staging`
- [ ] `lab3-staging` merged into `main` via a single release PR

## 11. Assumptions and Decisions
- **Session mechanism:** a signed JWT stored in an httpOnly, `SameSite=Lax`
  cookie (via `cookie-parser` + a `JWT_SECRET` in `server/.env`, never
  committed) rather than server-side session storage — simplest to implement
  correctly for a local Express + Vite-dev-server split-origin setup
  (`localhost:5173` / `localhost:3000`), which is same-site so `Lax` cookies
  are sent on same-site cross-port fetches without needing `SameSite=None`.
- **Password hashing:** `bcryptjs` (pure JS) instead of native `bcrypt`, to
  avoid native build/toolchain issues in the course's Windows/VS Code
  environment; cost factor 10.
- **`requesterId` column reuse:** the Lab 2 `Ticket.requesterId` foreign key
  is kept (renamed relation target to `User`) rather than introduced as a new
  column, to avoid an unnecessary data migration of existing Tickets.
- **"Appears resolved" as a flag, not a status:** implemented as a boolean +
  timestamp rather than a `WAITING_FOR_STAFF_CONFIRMATION`-style status value,
  since the handout (BR-05 example) is explicit that a Requester cannot
  formally change status — keeping it a separate signal avoids overloading
  the status enum with a non-authoritative state.
- **CORS must move from wildcard to explicit-origin + credentials:** Lab
  2's `app.use(cors())` (no options) reflects a wildcard origin, which the
  browser refuses to combine with credentialed (cookie-bearing) requests —
  it would silently fail to set or send `toktickit_session`, with no
  visible error. Lab 3's `cors()` call must be configured with `origin:
  "http://localhost:5173"` (explicit, not `*`) and `credentials: true`,
  and every frontend `fetch` call must pass `credentials: "include"`.
  `localhost:5173` and `localhost:3000` are same-site (SameSite ignores
  port) but still cross-origin, so both sides of this pairing are required
  for `SameSite=Lax` cookies to actually flow. This is called out
  explicitly here so it is handled from the first line of Issue #2
  (Authentication foundation), not discovered as a silent bug later.
- **IT Staff attachments are read-only in Lab 3:** the handout's IT Staff
  Ticket Detail description does not list attachment upload as a required
  IT Staff action, so Lab 3 keeps attachment add/remove Requester-only,
  consistent with "extends the Ticket screen created in Lab 2" without added
  scope.
