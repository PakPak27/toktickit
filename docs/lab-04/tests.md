# Lab 4 Test Plan and Results

## 1. Test Strategy
Tests are planned before implementation (Test DD) and written to fail first,
then made to pass while implementing each Issue (TDD). Every Acceptance
Criterion in `specification.md` maps to at least one automated test below.
Coverage spans: unit, API/integration (Supertest), UI component (Vitest +
Testing Library), responsive/visual (Playwright screenshots), authorization
(direct API calls bypassing the UI), workflow (the resolution gate and
status matrix), migration/regression (the full Labs 1–3 suite re-run
unmodified), and E2E (Playwright, full flow against a running dev server).

## 2. Planned Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| UNIT-01 | Unit | BR-11/BR-12 | Resolution-gate pure helper | Given an Actions-Taken list, returns blocked/allowed and the blocking entries | `server/tests/lab-04/resolution-gate.unit.test.ts` | Pass |
| API-01 | API | AC-01 | POST .../actions with valid data | 201; correct Ticket, correct `performedById` from session | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-02 | API | BR-05 | POST .../actions with empty/over-length description or result | 400; nothing created | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-03 | API | AC-03, BR-06 | POST .../actions with followUpRequired=true and no followUpNote | 400; nothing created | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-04 | API | AC-08, BR-08 | POST/PATCH .../actions as a Requester | 403; nothing created/changed | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-05 | API | AC-02, BR-02/BR-03 | PATCH an Action Taken created by a different IT Staff member | 200; `performedById` unchanged, `updatedAt` changes | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-06 | API | AC-07, BR-13 | PATCH with a stale `updatedAt` | 409 `STALE_UPDATE`; current record returned, not overwritten | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-07 | API | AC-08 | GET .../actions as the owning Requester | 200; read-only shape (no edit-only fields leaked) | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-08 | API | BR-08 | GET .../actions as a non-owning Requester | 403; no data | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-09 | API | AC-04, BR-11 | PATCH status to RESOLVED while an Action Taken has followUpRequired=true | 409 `RESOLUTION_BLOCKED`, `blockingActions` includes it | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass |
| API-10 | API | AC-05, BR-12 | PATCH status to RESOLVED with zero Actions Taken | 409 `RESOLUTION_BLOCKED` | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass |
| API-11 | API | AC-06 | Clear the open follow-up via PATCH .../actions, then retry RESOLVED | 200; status becomes RESOLVED | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass |
| API-12 | API | AC-07, BR-14 | PATCH status with a stale Ticket `updatedAt` | 409 `STALE_UPDATE` | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass |
| API-13 | API | Sec. 5.5 (Lab 3) | Full matrix-valid transition walk, now carrying `updatedAt` each step, ending in a gated RESOLVED | Each step succeeds in order; RESOLVED only after an Action Taken with no open follow-up exists | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass |
| API-14 | API | AC-09, BR-16 | GET /api/dashboard/requester as Requester A vs. B | Each sees only their own metrics/Tickets | `server/tests/lab-04/requester-dashboard.api.test.ts` | Pass |
| API-15 | API | BR-16 | GET /api/dashboard/requester as IT Staff | 403 | `server/tests/lab-04/requester-dashboard.api.test.ts` | Pass |
| API-16 | API | AC-11 | GET /api/dashboard/requester for a Requester with zero Tickets | 200; every count 0, empty lists, not an error | `server/tests/lab-04/requester-dashboard.api.test.ts` | Pass |
| API-17 | API | AC-10, BR-17 | GET /api/dashboard/staff: unassignedCount/myAssignedCount against known fixture data | Counts match a direct Prisma count for the same `where` | `server/tests/lab-04/staff-dashboard.api.test.ts` | Pass |
| API-18 | API | BR-17 | GET /api/dashboard/staff as Requester | 403 | `server/tests/lab-04/staff-dashboard.api.test.ts` | Pass |
| API-19 | API | FR-09 | GET /api/dashboard/staff as Administrator | 200; identical shape to IT Staff's response | `server/tests/lab-04/staff-dashboard.api.test.ts` | Pass |
| REGR-01 | Regression | AC-13 | Full Lab 2 + Lab 3 Supertest suites re-run unmodified on the Lab 4 branch | All existing assertions still pass | `server/tests/lab-02/*.test.ts`, `server/tests/lab-03/*.test.ts` | Pass |
| UI-01 | UI | Sec. 5 (ui-spec) | Actions Taken list: populated and empty states | Correct copy/rows for each; "Follow-up needed" badge shown correctly | `client/tests/lab-04/ActionsTaken.test.tsx` | Pass |
| UI-02 | UI | AC-03 | Add Action Taken form: Follow-up Note field | Appears and becomes required only when Follow-Up Required is checked | `client/tests/lab-04/ActionsTaken.test.tsx` | Pass |
| UI-03 | UI | AC-07 | Edit Action Taken: a 409 response | Shows "changed since you opened it" and reloads current values, edit not lost silently | `client/tests/lab-04/ActionsTaken.test.tsx` | Pass |
| UI-04 | UI | AC-08 | Requester Ticket Detail Actions Taken panel | Read-only: no Add/Edit controls rendered | `client/tests/lab-04/ActionsTaken.test.tsx` | Pass |
| UI-05 | UI | Sec. 7 (ui-spec) | Status select when the Ticket is resolution-gated | RESOLVED option omitted; reappears once ungated | `client/tests/lab-04/TicketWorkflow.test.tsx` | Pass |
| UI-06 | UI | AC-09, AC-12 | Requester Dashboard: metrics, recent list, attention list, drill-down links | Correct counts/rows rendered; links carry the right filter | `client/tests/lab-04/RequesterDashboard.test.tsx` | Pass |
| UI-07 | UI | AC-10, AC-12 | Staff Dashboard: metrics, recent list, drill-down links | Correct counts/rows rendered; links carry the right filter | `client/tests/lab-04/StaffDashboard.test.tsx` | Pass |
| UI-08 | UI | AC-11 | Both dashboards with all-zero data | Explicit "0" everywhere, no blank cards | `client/tests/lab-04/RequesterDashboard.test.tsx`, `StaffDashboard.test.tsx` | Pass |
| UI-09 | UI | Sec. 4 (ui-spec) | Dashboard loading and failure states | Skeleton while loading; safe inline error + Retry on failure | `client/tests/lab-04/StaffDashboard.test.tsx` | Pass |
| RESP-01 | Responsive | Sec. 11 (ui-spec) | Requester Dashboard, Staff Dashboard, Actions Taken panel at 1280/900/375px | No clipping, overlap, or horizontal scroll at any viewport | `artifacts/lab-04/screenshots/**/*.png` via `e2e/lab-04/dashboards.spec.ts` | Pass |
| E2E-01 | E2E | AC-01, AC-03, AC-04, AC-06 | Full flow: create an Action Taken with follow-up, attempt RESOLVED (blocked), edit to clear follow-up, RESOLVED succeeds | Each step succeeds/fails exactly as specified end-to-end | `e2e/lab-04/actions-taken-flow.spec.ts` | Pass |
| E2E-02 | E2E | AC-05 | Attempt RESOLVED on a Ticket with zero Actions Taken | Rejected with the resolution-blocked message shown in the UI | `e2e/lab-04/ticket-resolution.spec.ts` | Pass |
| E2E-03 | E2E | AC-09, AC-12 | Requester logs in, lands on Dashboard, drills into a metric | Dashboard shown first; drill-down opens My Tickets pre-filtered | `e2e/lab-04/dashboards.spec.ts` | Pass |
| E2E-04 | E2E | AC-10, AC-12 | IT Staff logs in, lands on Dashboard, drills into Unassigned | Dashboard shown first; drill-down opens the Ticket Queue pre-filtered | `e2e/lab-04/dashboards.spec.ts` | Pass |
| E2E-05 | E2E | AC-13 | Re-run the Lab 3 E2E suite (authentication, staff flow, admin flow, requester regression) | Identical outcomes to Lab 3, no regression from Lab 4 changes | `e2e/lab-03/*.spec.ts` (re-run, unmodified) | Pass |

## 3. Acceptance-Criterion Traceability

| AC | Covered by |
|---|---|
| AC-01 | API-01, UI-01, E2E-01 |
| AC-02 | API-05 |
| AC-03 | API-03, UI-02, E2E-01 |
| AC-04 | API-09, E2E-01 |
| AC-05 | API-10, E2E-02 |
| AC-06 | API-11, E2E-01 |
| AC-07 | API-06, API-12, UI-03 |
| AC-08 | API-04, API-07, API-08, UI-04 |
| AC-09 | API-14, UI-06, E2E-03 |
| AC-10 | API-17, UI-07, E2E-04 |
| AC-11 | API-16, UI-08 |
| AC-12 | UI-06, UI-07, E2E-03, E2E-04 |
| AC-13 | REGR-01, E2E-05 |
| AC-14 | (covered by UI busy-state assertions within UI-02/API-01 fixtures; no dedicated row) |

## 4. Responsive and Visual Checklist
Completed during the Final Hardening Issue, screenshot evidence under
`artifacts/lab-04/screenshots/`:
- [x] Requester Dashboard and Staff Dashboard usable at all 3 viewports
- [x] Actions Taken panel (list, create, edit, conflict) usable at all 3
      viewports
- [x] Follow-up Note conditional field never clips or overlaps at any size
- [x] Dashboard metric cards never show a blank/undefined value
- [x] No clipping, overlap, or unintended horizontal scroll anywhere
- [x] Keyboard focus visible and in order on every new screen
- [x] Full Lab 2 + Lab 3 responsive checklists still pass unmodified

## 5. Test Commands
```bash
# Backend unit + API tests
cd server && npm test

# Frontend unit/UI tests
cd client && npm test

# E2E + visual (from repo root, dev servers running)
npx playwright test e2e/lab-04
npx playwright test e2e/lab-03 --grep-invert "report-evidence"   # regression
```
`e2e/lab-03/report-evidence.spec.ts` is a one-shot evidence-capture spec (its
own header says so) that deliberately resets a fixture account's password
mid-flow — excluded from the regression command for the same reason the
README's regression instructions already scope to the suite proper, not
one-off evidence capture.

## 6. Final Results
All planned tests pass. 124/124 server (Vitest), 61/61 client (Vitest),
13/13 Lab 4 Playwright E2E/visual, 21/21 Lab 3 Playwright regression
(`--grep-invert "report-evidence"`) — run against `lab4-staging` ahead of
the `main` release PR; re-confirmed after that merge.

Picked up from my reviewer's non-blocking PR #56 feedback during this
Issue: the resolution-gate read and the status write were two separate
statements, and wrapping both in one `prisma.$transaction` (my first attempt)
turned out not to actually close the race — Postgres's default READ
COMMITTED isolation takes no lock on rows a transaction only reads, so a
concurrent Action Taken write could still commit in between and leave the
gate's decision stale. Reviewer PR #58 caught this. The actual fix: every
Action Taken write (`POST`/`PATCH .../actions`) now also bumps the Ticket's
own `updatedAt` inside its own transaction, so the status route's existing
optimistic-concurrency check (the `updateMany` keyed on `updatedAt`) sees it
and rejects as stale instead of letting a now-invalid gate decision through.
My partner's equivalent endpoint had the identical gap and is fixing it
separately — this is not a case of matching an already-correct pattern.
Added the true-concurrency test the same PR #56 review asked for
(`Promise.all` on two status changes with the same `updatedAt` — exactly one
200, one 409), plus a second one from PR #58's review demonstrating the
Actions-Taken-vs-status race itself is closed.

## 7. Known Limitations or Deferred Tests
- Performance/load testing of the dashboard queries at large data volumes
  is not covered beyond functional correctness at the seeded scale (API-17);
  no dedicated performance-smoke test is planned given the labsheet's
  explicit exclusion of production-scale concerns.
- The Action Taken stale-edit check (API-06) is still only tested via a
  sequential simulation, not true parallel-request timing like the Ticket
  status check now has — sufficient to prove the check exists and rejects
  correctly, not to characterize race-window size. Same fix (a
  `Promise.all` test) would close this if it's ever revisited. (The
  Actions-Taken-vs-status race specifically, which is a different check, now
  has its own `Promise.all` test — see above.)
- Reviewer PR #57 raised two product-judgment points deliberately left
  as-is rather than changed late without a spec update: the Staff
  dashboard's `unassignedCount`/`myAssignedCount` include finished
  (Resolved/Closed/Cancelled) Tickets, consistent with the Ticket Queue's
  own `owner` filter scope, so the count and its drill-down still agree —
  an active-only definition might read better but would need
  `specification.md` updated alongside it; and the Requester dashboard's
  "Open" card label means the aggregate active-status count while "Open"
  is also one specific status in the same screen's filter dropdown — the
  dropdown itself already disambiguates ("Open (not Resolved/Closed/
  Cancelled)" vs "Open"), so left as specified in `ui-spec.md` §2.
- Three pre-existing Lab 2/3 test-suite fragilities were found and fixed
  while building this Issue, none caused by Lab 4's own application code but
  all blocking a clean regression run:
  1. Two Supertest `beforeAll` blocks (`tests/lab-03/users-admin.api.test.ts`,
     and separately a stray account left by `e2e/lab-03/
     user-administration.spec.ts`) each leave a throwaway Administrator/IT
     Staff-role user behind with no cleanup. Several other files resolved
     "the" seeded Administrator/IT Staff/Requester via an *unordered*
     `findFirst`, which could then non-deterministically pick up one of
     these leftovers instead of the real seeded account — observed
     firsthand breaking unrelated Supertest files more than once this
     session. Fixed at the root (an `afterAll` in the first file) and
     defensively everywhere else (`orderBy: { id: "asc" }` added to every
     such lookup across `tests/lab-02`, `lab-03`, and `lab-04`), so a future
     leftover from anywhere can't repeat this.
  2. Supertest's `loginAsAgent` (server tests) and Playwright's `loginAsUI`
     (E2E tests) disagree about a shared seeded account's password after
     the account's mandatory first-login change: Supertest always assumes
     `SEED_PASSWORD`, while Playwright's `loginAsUI` actually completes the
     change-password flow to `E2E_PASSWORD` the first time it logs an
     account in. Running the E2E regression before the Supertest suite
     against the same persistent dev DB leaves any account used by both
     (`michael.brown@example.com`, here) unable to log in via
     `loginAsAgent` afterward. Not fixed in the test helpers themselves
     (a larger, pre-existing convention mismatch outside this Issue's
     scope) — worth a shared fixture-account convention in a future lab if
     it keeps recurring.
  3. Several `e2e/lab-03` specs assumed login lands directly on the role's
     own list screen, which Lab 4's new Dashboard landing page broke;
     updated to the deliberate new landing behavior
     (`docs/lab-04/specification.md` Assumptions) and, where a test needed
     the list screen specifically, to navigate there via the nav link
     first. Separately, `StaffDashboard`'s new "View Ticket Queue" button
     made every unqualified `getByRole("link", { name: "Ticket Queue" })`
     query ambiguous (substring-matches both it and the nav link) — added
     `exact: true` everywhere that query appears, matching the convention
     already used for "My Tickets"/"Create Ticket".
- `e2e/lab-03/report-evidence.spec.ts`'s own `05-05` test deliberately
  leaves a fixture account (`michael.brown@example.com`) mid-password-reset
  — by design for that one-shot evidence capture, but it corrupts that
  account for any other spec run in the same invocation afterward (observed
  firsthand). Not fixed, since the file's own header already documents it
  as a separate one-shot capture, not part of the regression suite; the
  regression command above excludes it for that reason. Running it
  standalone and then re-seeding/resetting `michael.brown`'s password
  before the next regression run avoids the collision.
