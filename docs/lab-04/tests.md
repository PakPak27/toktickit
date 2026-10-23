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
| UNIT-01 | Unit | BR-11/BR-12 | Resolution-gate pure helper | Given an Actions-Taken list, returns blocked/allowed and the blocking entries | `server/tests/lab-04/resolution-gate.unit.test.ts` | Pending |
| API-01 | API | AC-01 | POST .../actions with valid data | 201; correct Ticket, correct `performedById` from session | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-02 | API | BR-05 | POST .../actions with empty/over-length description or result | 400; nothing created | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-03 | API | AC-03, BR-06 | POST .../actions with followUpRequired=true and no followUpNote | 400; nothing created | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-04 | API | AC-08, BR-08 | POST/PATCH .../actions as a Requester | 403; nothing created/changed | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-05 | API | AC-02, BR-02/BR-03 | PATCH an Action Taken created by a different IT Staff member | 200; `performedById` unchanged, `updatedAt` changes | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-06 | API | AC-07, BR-13 | PATCH with a stale `updatedAt` | 409 `STALE_UPDATE`; current record returned, not overwritten | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-07 | API | AC-08 | GET .../actions as the owning Requester | 200; read-only shape (no edit-only fields leaked) | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-08 | API | BR-08 | GET .../actions as a non-owning Requester | 403; no data | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-09 | API | AC-04, BR-11 | PATCH status to RESOLVED while an Action Taken has followUpRequired=true | 409 `RESOLUTION_BLOCKED`, `blockingActions` includes it | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pending |
| API-10 | API | AC-05, BR-12 | PATCH status to RESOLVED with zero Actions Taken | 409 `RESOLUTION_BLOCKED` | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pending |
| API-11 | API | AC-06 | Clear the open follow-up via PATCH .../actions, then retry RESOLVED | 200; status becomes RESOLVED | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pending |
| API-12 | API | AC-07, BR-14 | PATCH status with a stale Ticket `updatedAt` | 409 `STALE_UPDATE` | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pending |
| API-13 | API | Sec. 5.5 (Lab 3) | Full matrix-valid transition walk, now carrying `updatedAt` each step, ending in a gated RESOLVED | Each step succeeds in order; RESOLVED only after an Action Taken with no open follow-up exists | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pending |
| API-14 | API | AC-09, BR-16 | GET /api/dashboard/requester as Requester A vs. B | Each sees only their own metrics/Tickets | `server/tests/lab-04/requester-dashboard.api.test.ts` | Pending |
| API-15 | API | BR-16 | GET /api/dashboard/requester as IT Staff | 403 | `server/tests/lab-04/requester-dashboard.api.test.ts` | Pending |
| API-16 | API | AC-11 | GET /api/dashboard/requester for a Requester with zero Tickets | 200; every count 0, empty lists, not an error | `server/tests/lab-04/requester-dashboard.api.test.ts` | Pending |
| API-17 | API | AC-10, BR-17 | GET /api/dashboard/staff: unassignedCount/myAssignedCount against known fixture data | Counts match a direct Prisma count for the same `where` | `server/tests/lab-04/staff-dashboard.api.test.ts` | Pending |
| API-18 | API | BR-17 | GET /api/dashboard/staff as Requester | 403 | `server/tests/lab-04/staff-dashboard.api.test.ts` | Pending |
| API-19 | API | FR-09 | GET /api/dashboard/staff as Administrator | 200; identical shape to IT Staff's response | `server/tests/lab-04/staff-dashboard.api.test.ts` | Pending |
| REGR-01 | Regression | AC-13 | Full Lab 2 + Lab 3 Supertest suites re-run unmodified on the Lab 4 branch | All existing assertions still pass | `server/tests/lab-02/*.test.ts`, `server/tests/lab-03/*.test.ts` | Pending |
| UI-01 | UI | Sec. 5 (ui-spec) | Actions Taken list: populated and empty states | Correct copy/rows for each; "Follow-up needed" badge shown correctly | `client/tests/lab-04/ActionsTaken.test.tsx` | Pending |
| UI-02 | UI | AC-03 | Add Action Taken form: Follow-up Note field | Appears and becomes required only when Follow-Up Required is checked | `client/tests/lab-04/ActionsTaken.test.tsx` | Pending |
| UI-03 | UI | AC-07 | Edit Action Taken: a 409 response | Shows "changed since you opened it" and reloads current values, edit not lost silently | `client/tests/lab-04/ActionsTaken.test.tsx` | Pending |
| UI-04 | UI | AC-08 | Requester Ticket Detail Actions Taken panel | Read-only: no Add/Edit controls rendered | `client/tests/lab-04/ActionsTaken.test.tsx` | Pending |
| UI-05 | UI | Sec. 7 (ui-spec) | Status select when the Ticket is resolution-gated | RESOLVED option omitted; reappears once ungated | `client/tests/lab-04/TicketWorkflow.test.tsx` | Pending |
| UI-06 | UI | AC-09, AC-12 | Requester Dashboard: metrics, recent list, attention list, drill-down links | Correct counts/rows rendered; links carry the right filter | `client/tests/lab-04/RequesterDashboard.test.tsx` | Pending |
| UI-07 | UI | AC-10, AC-12 | Staff Dashboard: metrics, recent list, drill-down links | Correct counts/rows rendered; links carry the right filter | `client/tests/lab-04/StaffDashboard.test.tsx` | Pending |
| UI-08 | UI | AC-11 | Both dashboards with all-zero data | Explicit "0" everywhere, no blank cards | `client/tests/lab-04/RequesterDashboard.test.tsx`, `StaffDashboard.test.tsx` | Pending |
| UI-09 | UI | Sec. 4 (ui-spec) | Dashboard loading and failure states | Skeleton while loading; safe inline error + Retry on failure | `client/tests/lab-04/StaffDashboard.test.tsx` | Pending |
| RESP-01 | Responsive | Sec. 11 (ui-spec) | Requester Dashboard, Staff Dashboard, Actions Taken panel at 1280/900/375px | No clipping, overlap, or horizontal scroll at any viewport | `artifacts/lab-04/screenshots/**/*.png` via `e2e/lab-04/dashboards.spec.ts` | Pending |
| E2E-01 | E2E | AC-01, AC-03, AC-04, AC-06 | Full flow: create an Action Taken with follow-up, attempt RESOLVED (blocked), edit to clear follow-up, RESOLVED succeeds | Each step succeeds/fails exactly as specified end-to-end | `e2e/lab-04/actions-taken-flow.spec.ts` | Pending |
| E2E-02 | E2E | AC-05 | Attempt RESOLVED on a Ticket with zero Actions Taken | Rejected with the resolution-blocked message shown in the UI | `e2e/lab-04/ticket-resolution.spec.ts` | Pending |
| E2E-03 | E2E | AC-09, AC-12 | Requester logs in, lands on Dashboard, drills into a metric | Dashboard shown first; drill-down opens My Tickets pre-filtered | `e2e/lab-04/dashboards.spec.ts` | Pending |
| E2E-04 | E2E | AC-10, AC-12 | IT Staff logs in, lands on Dashboard, drills into Unassigned | Dashboard shown first; drill-down opens the Ticket Queue pre-filtered | `e2e/lab-04/dashboards.spec.ts` | Pending |
| E2E-05 | E2E | AC-13 | Re-run the Lab 3 E2E suite (authentication, staff flow, admin flow, requester regression) | Identical outcomes to Lab 3, no regression from Lab 4 changes | `e2e/lab-03/*.spec.ts` (re-run, unmodified) | Pending |

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
To be completed during the Final Hardening Issue, recorded here with
screenshot evidence under `artifacts/lab-04/screenshots/`:
- [ ] Requester Dashboard and Staff Dashboard usable at all 3 viewports
- [ ] Actions Taken panel (list, create, edit, conflict) usable at all 3
      viewports
- [ ] Follow-up Note conditional field never clips or overlaps at any size
- [ ] Dashboard metric cards never show a blank/undefined value
- [ ] No clipping, overlap, or unintended horizontal scroll anywhere
- [ ] Keyboard focus visible and in order on every new screen
- [ ] Full Lab 2 + Lab 3 responsive checklists still pass unmodified

## 5. Test Commands
```bash
# Backend unit + API tests
cd server && npm test

# Frontend unit/UI tests
cd client && npm test

# E2E + visual (from repo root, dev servers running)
npx playwright test e2e/lab-04
npx playwright test e2e/lab-03   # regression, must still be 21/21
```

## 6. Final Results
_To be filled in once implementation is complete and all tests are run
against the final `main` branch — pass/fail status per Test ID above._

## 7. Known Limitations or Deferred Tests
- Performance/load testing of the dashboard queries at large data volumes
  is not covered beyond functional correctness at the seeded scale (API-17);
  no dedicated performance-smoke test is planned given the labsheet's
  explicit exclusion of production-scale concerns.
- Concurrent-edit races on Actions Taken/status are tested via a single
  sequential "stale updatedAt" simulation (API-06/API-12), not true
  parallel-request timing — sufficient to prove the check exists and
  rejects correctly, not to characterize race-window size.
