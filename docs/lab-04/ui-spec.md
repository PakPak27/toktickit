# Lab 4 UI Specification — Zen Green Theme (extends Lab 2/Lab 3)

Lab 4 reuses every Zen Green token, form convention, badge style, button
hierarchy, and responsive breakpoint from Labs 2–3 unchanged
(`docs/lab-02/ui-spec.md` §1–9, `docs/lab-03/ui-spec.md` throughout). This
document covers only what Lab 4 adds: Dashboards, the Actions Taken panel,
and the resolution-gate UI hint.

## 1. Navigation Changes
- A new "Dashboard" link is the first nav item for Requester, IT Staff, and
  Administrator alike, and is now the default landing destination
  (`HomeRedirect` / `/` forwards here instead of straight to My
  Tickets/Ticket Queue).
- My Tickets / Ticket Queue / Users remain reachable from nav exactly as in
  Lab 3 — the Dashboard supplements them, it does not replace them.

## 2. Requester Dashboard
- Metric cards (reusing the Lab 2/3 card component): Open, In Progress,
  Waiting for Requester, Resolved, Closed — each a label + count, clicking
  it opens My Tickets pre-filtered to that status (or "not
  Resolved/Closed/Cancelled" for Open).
- "Recent Tickets" list (≤5 rows): Ticket Number, Summary, Status badge,
  Last Updated — row click opens that Ticket's Detail.
- "Needs Your Attention" list (≤5 rows, only Tickets `WAITING_FOR_REQUESTER`
  for this Requester) — shown above Recent Tickets when non-empty; omitted
  entirely (not an empty card) when there is nothing waiting, to avoid
  implying action is needed when none is.
- Quick Actions: Create Ticket, View My Tickets (same destinations as the
  Lab 2 nav items).
- Empty state (a brand-new Requester with zero Tickets): all counts show
  "0", Recent Tickets shows "You haven't created any tickets yet." with a
  Create Ticket call to action — same copy as My Tickets' own empty state.

## 3. IT Staff / Administrator Dashboard
- Metric cards: New, Open, In Progress, Waiting for Requester, Unassigned,
  My Assigned — each clicking into the Ticket Queue pre-filtered
  (status=value, or `ownership=unassigned`/`ownership=mine` for the last
  two).
- "Recent Tickets" list (≤5 rows, system-wide): Ticket Number, Summary,
  Status badge, Owner (or "Unassigned"), Last Updated — row click opens
  Staff Ticket Detail.
- Administrators see the identical screen (`/api/dashboard/staff` is shared,
  per `specification.md` §11); no separate Administrator-only cards in
  Lab 4.
- Empty state (zero Tickets system-wide — only plausible on a fresh/empty
  dev database): every count "0", Recent Tickets shows "No tickets in the
  system yet." — same copy as the Ticket Queue's own system-wide-empty
  state.

## 4. Dashboard Shared Rules
- Loading: skeleton/placeholder cards, no layout shift once data arrives.
- Failure: a single safe inline error banner ("Unable to load your
  dashboard. Please try again.") with a Retry action — never a raw stack
  trace, matching every other screen's failure convention.
- Every card/list row is reachable and operable by keyboard; a card is a
  real `<button>`/`<a>`, not a `<div onClick>`.
- Counts never render blank — a genuine zero renders "0", not an empty box.

## 5. Actions Taken Panel (IT Staff/Administrator Ticket Detail)
- A new tab alongside the existing Public Comments / Internal Notes /
  Attachments tabs (Lab 3 §6), labelled "Actions Taken (N)" with the live
  count.
- List (newest first): each row shows Action Date/Time, Performed By,
  Result (truncated with full text on hover/expand), a "Follow-up needed"
  badge when that entry's `followUpRequired` is true, and an "Edit" action.
- "Add Action Taken" button opens a form (inline panel, matching the
  Public-Comment/Internal-Note add-box pattern): Description (textarea),
  Result (textarea), Follow-Up Required (checkbox), Follow-up Note
  (textarea, appears and becomes required only when the checkbox is
  checked — matching the Lab 3 Change-Password live-validation pattern of
  a field whose requiredness depends on another field), Attachment Notes
  (optional text input).
- Edit reuses the same form, pre-filled, replacing the row in place; saving
  sends the `updatedAt` the row was loaded with (api-spec.md) — a 409 shows
  "This entry changed since you opened it." and reloads the current values
  rather than silently discarding the edit.
- Submit buttons show a busy state and are disabled while in flight
  (duplicate-submit protection, FR-13/BR-15).

## 6. Requester Ticket Detail — Actions Taken (read-only)
- Same list presentation as §5 above, but no Add/Edit controls — a plain
  read-only panel, consistent with how Requesters already see Public
  Comments (read + add) vs. Internal Notes (never shown) as a precedent for
  "same data model, different permitted operations per role."
- Empty state: "No actions recorded yet." (distinct copy from "No comments
  yet." so the two empty panels are never confused).

## 7. Resolution-Gate UI Hint
- The status `<select>` on IT Staff Ticket Detail omits `RESOLVED` from its
  options (client-side hint only) whenever the currently-loaded Ticket has
  zero Actions Taken, or at least one with `followUpRequired = true` —
  recomputed after every Actions Taken create/edit without a full page
  reload.
- This is a convenience, not the authority: if the hint is stale (e.g. two
  staff editing concurrently) and `RESOLVED` is still submitted, the
  backend's `RESOLUTION_BLOCKED` response (api-spec.md) is shown as an
  inline error naming the specific blocking Action(s), with a link to jump
  to that row in the Actions Taken tab.

## 8. Badge Addition
| Value | Badge color | Text |
|---|---|---|
| Follow-up needed (on an Actions Taken row) | `--color-warning-bg` bg, `--color-warning` text | "Follow-up needed" |

Reuses the existing warning token pair from Lab 3's badge set — no new
color introduced.

## 9. Screen States and Feedback
Same rule as Lab 2 §7/Lab 3 §9, extended to Dashboards (loading, empty,
forbidden, safe-failure — no distinct "success" state since a dashboard is
read-only) and Actions Taken (loading, validation, submitting/busy,
success, empty, forbidden, not-found, conflict `409`, safe API-failure).

## 10. Responsive and Accessibility Requirements
Same as Lab 2/Lab 3 (desktop ≥992px, tablet 768–991px, mobile <768px).
Dashboard metric cards reflow to a 2-column grid on tablet and a single
column on mobile; the Actions Taken list becomes a stacked card list on
mobile matching the existing Ticket Queue mobile-card pattern. Keyboard
focus order follows visual/reading order on every new screen; the
Follow-up Note field's conditional appearance never traps or skips focus.

## 11. Visual Inspection Checklist and Screenshot Paths
Checklist (to be completed during the Final Hardening Issue, recorded in
`tests.md` §4):
- [ ] Requester Dashboard and Staff Dashboard readable and usable at all 3
      viewports
- [ ] Actions Taken panel (list, create, edit, conflict) usable at all 3
      viewports
- [ ] Follow-up Note conditional field never clips or overlaps at any size
- [ ] Dashboard metric cards never show a blank/undefined value
- [ ] No clipping, overlap, or unintended horizontal scroll anywhere
- [ ] Keyboard focus visible and in order on every new screen

Screenshot paths (Playwright, `e2e/lab-04/dashboards.spec.ts` and
`actions-taken-flow.spec.ts`):
```
artifacts/lab-04/screenshots/
├── staff-dashboard/        (desktop/tablet/mobile)
├── requester-dashboard/    (desktop/tablet/mobile)
└── actions-taken/          (desktop/tablet/mobile)
```
