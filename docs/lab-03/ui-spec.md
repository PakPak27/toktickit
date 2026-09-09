# Lab 3 UI Specification — Zen Green Theme (extended)

All Lab 2 tokens, typography, spacing, field states, button hierarchy, and
accessibility rules (`docs/lab-02/ui-spec.md` Sections 1–6, 9) remain
unchanged and in force. This document only adds what Lab 3 introduces.

## 1. New / Changed Tokens
No new color tokens. Two new badge families reuse existing tokens:

| Badge | Color source |
|---|---|
| Role: Requester | `--color-pale` bg, `--color-secondary` text |
| Role: IT Staff | light blue-green tint (`--color-secondary` at 15% on white), `--color-secondary` text |
| Role: Administrator | `--color-primary` at 15% tint, `--color-primary` text |
| Status: OPEN / IN_PROGRESS | `--color-pale` bg, `--color-secondary` text |
| Status: WAITING_FOR_REQUESTER | `--color-warning-bg` bg, `--color-warning` text |
| Status: RESOLVED / CLOSED | `--color-pale` bg, `--color-success` text, checkmark icon |
| Status: REOPENED | `--color-warning-bg` bg, `--color-warning` text |
| Status: CANCELLED | gray bg, gray text |
| IT Priority: LOW/MEDIUM/HIGH | same scale as Requested Priority (Lab 2 Section 14) |

## 2. Application Shell Changes
- The Development Requester name + "Change Requester" tertiary button
  (Lab 2 Section 11) is replaced by: current user's **name**, a **role
  badge**, and a **Logout** tertiary action, right-aligned in the header.
- Navigation is role-filtered, not just role-styled — a Requester never sees
  "Ticket Queue" or "Users" in the DOM, an IT Staff user never sees "Create
  Ticket" or "Users", an Administrator sees "Users" only (not Ticket Queue,
  per the handout's Administrator/IT-Staff separation).
- Mobile: unchanged hamburger pattern from Lab 2; user name/role/logout move
  into the collapsed menu.

## 3. Login Screen
- Centered card (max-width ~400px), TokTickIT title above the form.
- Fields: Email (type="email", required), Password (type="password",
  required, show/hide toggle icon).
- Validation: inline "Email is required" / "Password is required" on blur
  or submit attempt; never blocks typing.
- Submit ("Sign In"): primary button, full-width, busy state while the
  request is in flight (spinner + disabled, per Lab 2 button-hierarchy busy
  rule).
- Failure: one dismissible inline banner directly above the form fields —
  "Invalid email or password." — shown identically for wrong password and
  inactive account (BR-01/BR-02, AC-02); never a field-specific message that
  would reveal which field was wrong.
- No "Forgot password?" link (excluded from Lab 3 scope).

## 4. Change Password Screen (mandatory first login)
- Rendered in place of the entire application shell — no nav, no logout
  bypass — whenever the current user's `mustChangePassword` is true; this is
  enforced by a route guard reading `/api/auth/me`, not a client-only flag.
- Fields: Current (temporary) Password, New Password, Confirm New Password —
  all with show/hide toggles.
- Live rule checklist below New Password (per BR-07), each rule shown with a
  neutral icon that turns to a green check as it becomes satisfied while
  typing:
  - At least 8 characters
  - At least one uppercase and one lowercase letter
  - At least one digit
  - At least one special character
- "Continue" primary button disabled until all rules pass and Confirm
  matches New Password; busy state on submit.
- Success: no separate screen — on 200 the app immediately renders the
  normal authenticated shell for the user's role (session stays valid,
  BR-08).
- Failure: inline banner above the fields (e.g., "Current password is
  incorrect" or a safe generic message), form values for New/Confirm
  retained, Current Password field cleared for re-entry.

## 5. Requester Ticket Detail — Additions
Layout is the Lab 2 Ticket Detail screen (Section 16 of `docs/lab-02/ui-spec.md`)
with two additions below the existing header/Attachments sections:
- **"Problem Appears Resolved" action:** a secondary button, hidden once
  already set or once status is `CLOSED`/`CANCELLED`; on success it becomes
  a pale-green badge "You indicated this appears resolved on {date}" instead
  of a button (BR-21).
- **Public Comments thread:** a card below Attachments — list of comments
  (author name + role badge, timestamp, content) newest-last, and an
  "Add Comment" textarea + Post button beneath the list, mirroring the
  Figure-1 style shown in the labsheet. Empty state: "No comments yet."

## 6. IT Staff Ticket Queue
- **Desktop table columns:** Ticket No., Created Date, Summary, Category,
  Requested Priority (badge), IT Priority (badge, "—" if unset), Current
  Status (badge), Ticket Owner (name or "Unassigned" in muted italic).
- **Mobile card:** Ticket No. + Status badge on top row; Summary as title;
  Owner, Category, Req./IT Priority as compact meta rows; entire card tappable.
- **Search:** single text input over Ticket Number/Summary, debounced ~300ms.
- **Filters:** Status, Category, IT Priority, and an Owner filter with values
  "All / Unassigned / Mine" (mine = current IT Staff session user).
- **Sort:** clickable column headers (desktop) with ↑/↓ indicator; dropdown
  on mobile. Default: Current Status priority order (open work first) then
  Created Date ascending — documented exactly in `api-spec.md` Section 3.
- **Pagination:** identical control pattern to Lab 2 My Tickets (page-size
  10/20/50 desktop, simplified Prev/Next mobile).
- **Empty:** "No tickets in the system yet." (system-wide, distinct copy
  from Lab 2's per-Requester empty state).
- **No Results:** "No tickets match your filters." + Clear Filters, same
  pattern as Lab 2.
- **Forbidden:** if a non-Staff/Admin user somehow reaches this route
  client-side (e.g., stale tab after a role change), show a full-page
  "You don't have access to this page" state rather than a blank/broken grid.

## 7. IT Staff Ticket Detail
Extends the Lab 2 Ticket Detail layout:
- **Header section (read-only, unchanged fields):** Ticket No., Created
  Date, Category, Related System, Requester name, Requested Priority,
  Summary, Description — identical presentation to Requester view.
- **Editable operational fields (new, grouped together, editable-field
  styling):**
  - **Ticket Owner** — dropdown of active IT Staff/Administrator users plus
    "Claim for me" quick action when unassigned; changing it saves
    immediately (PATCH on change, inline saving spinner next to the field).
  - **IT Priority** — dropdown LOW/MEDIUM/HIGH, saves on change.
  - **Current Status** — dropdown constrained to only the statuses valid
    from the current status per the transition matrix (Section 5.5 of
    `specification.md`); invalid targets are not shown as options at all,
    not just disabled.
- **Tabs/segments below the header:** **Public Comments** | **Internal
  Notes** | **Attachments** (read-only list, same presentation as Lab 2).
  Public Comments and Internal Notes use visually distinct card backgrounds
  — Public Comments on white/pale-green, Internal Notes on a light amber
  tint with a small "Internal — not visible to Requester" label pinned atop
  that tab, so no one confuses which box they are typing into.
- **Requester's "appears resolved" indicator:** shown as a small badge in
  the header section (not a tab) so IT Staff sees it immediately without
  switching tabs.
- **Saving/failure feedback:** each editable field shows its own inline
  saving spinner and, on failure, an inline red message next to that field
  with the previous value restored (optimistic-update rollback) — not a
  page-level reload.

## 8. Administrator User Management
- **Single screen**, no separate create/edit routes — Create and Edit open
  the same slide-over/modal form (Create: empty + password field; Edit:
  pre-filled, no password field, "Set New Password" as a separate secondary
  action inside the modal).
- **List:** Name, Email, Role (badge), Status (Active/Inactive badge), Edit
  icon-button (with `aria-label="Edit user"`). No pagination, no
  multi-column sort, no multi-filter — a single role `<select>` filter and
  one search box are the only list controls (per handout Section 8.5's
  explicit exclusions).
- **Create/Edit form fields:** Full Name, Email, Role (select), Active
  (toggle), and — Create only — Initial Password (pre-filled with a
  "Generate" button producing a rule-compliant random password, editable).
- **Validation:** inline messages per field; duplicate-email failure (409)
  surfaces under the Email field specifically ("This email is already in
  use."), not as a page banner.
- **Safety-rule feedback:** attempting to deactivate one's own account or
  the last active Administrator shows an inline red message under the
  Active toggle explaining why the action is blocked, and the toggle
  visually reverts (BR-32/BR-33, AC-17).
- **"Set New Password" action (Edit modal):** opens a small confirm step —
  "This will require {name} to set a new password at their next login." —
  then a generated/editable password field, Confirm button.
- **Forbidden:** non-Administrators attempting to reach this route see the
  same full-page "You don't have access to this page" state as Section 6.

## 9. Required Screen Modes and Feedback
Per screen: **Initial**, **Loading**, **Validation**, **Saving/Busy**,
**Success**, **Empty**, **No Results** (list screens), **Forbidden** (403),
**Not Found** (404), **Conflict** (409, e.g. duplicate email or invalid
status transition), and **Safe Failure** (500) — reusing the exact visual
language established in Lab 2 Section 7, extended with **Forbidden** (full-
page state, Section 6/8 above) and **Conflict** (inline field/section
message, never a raw error).

## 10. Responsive and Accessibility Requirements
Identical to Lab 2 (`docs/lab-02/ui-spec.md` Sections 8–9), applied to the
two new screens (Ticket Queue, User Management) and the Login/Change
Password screens. Additional accessibility notes:
- The role badge and status/priority badges never rely on color alone (text
  label always present, per Lab 2 Section 9 and BR-consistent handling).
- The Public Comments vs. Internal Notes tabs are reachable and announced
  distinctly via `aria-label` (e.g., "Public Comments, visible to
  Requester" vs. "Internal Notes, staff only") so the distinction is not
  purely visual.

## 11. Visual Inspection Checklist and Screenshot Paths
Checklist (completed during the responsive/visual-QA Issue, recorded in
`tests.md` Section 4):
- [ ] Role-based navigation shows only permitted destinations at all 3
      viewports
- [ ] Login/Change Password readable and usable at all 3 viewports
- [ ] Ticket Queue desktop table / mobile card both usable, no overflow
- [ ] IT Staff Ticket Detail: Public Comments vs. Internal Notes visually
      distinct at all 3 viewports
- [ ] User Management modal usable at all 3 viewports (no clipped fields)
- [ ] No clipping, overlap, or unintended horizontal scroll anywhere

Screenshot paths (Playwright, `e2e/lab-03/visual.spec.ts`):
`artifacts/lab-03/screenshots/{authentication,staff-queue,staff-ticket-detail,user-management}/`
