# Lab 3 Test Plan and Results

## 1. Test Strategy
Tests are planned before implementation (Test DD) and written to fail first,
then made to pass while implementing each Issue (TDD). Every Acceptance
Criterion in `specification.md` maps to at least one automated test below.
Coverage spans: unit, API/integration (Supertest), UI component (Vitest +
Testing Library), responsive/visual (Playwright screenshots), security/
authorization (direct API calls bypassing the UI), migration/regression
(re-running the Lab 2 suite under authenticated sessions), and E2E
(Playwright, full flow against a running dev server).

## 2. Planned Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| UNIT-01 | Unit | BR-07 | Password rule validator | Rejects <8 chars, missing upper/lower/digit/special; accepts compliant password | `server/tests/lab-03/password-rules.unit.test.ts` | Pass |
| UNIT-02 | Unit | BR-17 | Status-transition matrix helper | Returns correct valid-next-status set for every status | `server/tests/lab-03/status-transitions.unit.test.ts` | Pending (IT Staff Ticket operations issue) |
| API-01 | API | AC-01 | POST /api/auth/login valid credentials | 200; session cookie set; correct id/name/role returned | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-02 | API | AC-02 | Login with wrong password AND with inactive account | Both return identical 401 body | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-03 | API | AC-03 | Login as mustChangePassword user, then exercise the change-password gate (wrong current password, weak new password, then a valid change) | 401/400 as appropriate; mustChangePassword clears to false on success, confirmed via GET /api/auth/me | `server/tests/lab-03/auth.api.test.ts` | Pass — adapted from the original wording since no non-auth protected route exists to gate until Issue #3 (Requester regression) migrates one; the underlying `requirePasswordChangeComplete` middleware itself is exercised once such a route exists |
| API-04 | API | AC-19 | Call GET /api/auth/me after logout with the old cookie | 401 | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-05 | API | AC-04 | POST /api/tickets with a spoofed requesterId in the body, as Requester A | Ticket is created owned by A (session identity), not the spoofed id | `server/tests/lab-03/authorization.api.test.ts` | Pending |
| API-06 | API | AC-05 | GET /api/tickets/:id for Requester B's ticket, as Requester A | 403/404, no ticket data | `server/tests/lab-03/authorization.api.test.ts` | Pending |
| API-07 | API | AC-06 | POST /api/staff/tickets/:id/notes as a Requester | 403, no note content returned or stored | `server/tests/lab-03/authorization.api.test.ts` | Pending |
| API-08 | API | AC-18 | Call every /api/admin/* and /api/staff/* endpoint as a Requester | All return 403 | `server/tests/lab-03/authorization.api.test.ts` | Pending |
| API-09 | API | AC-07 | PATCH /api/staff/tickets/:id/owner on an unassigned ticket | 200; ticketOwner set to the claiming IT Staff user | `server/tests/lab-03/staff-queue.api.test.ts` | Pending |
| API-10 | API | AC-08 | PATCH owner from IT Staff A to IT Staff B (reassignment) | 200; ticketOwner updates to B | `server/tests/lab-03/staff-queue.api.test.ts` | Pending |
| API-11 | API | AC-09 | PATCH status NEW -> RESOLVED directly | 400; validNextStatuses list returned; status unchanged | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pending |
| API-12 | API | AC-10 | PATCH status to RESOLVED on an unassigned ticket | 409; status unchanged | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pending |
| API-13 | API | Sec. 5.5 | Walk every matrix-valid transition end-to-end (NEW->OPEN->IN_PROGRESS->RESOLVED->CLOSED->REOPENED) | Each succeeds in sequence | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pending |
| API-14 | API | AC-11 | POST Public Comment as Requester, then GET as IT Staff on same ticket | Comment visible to both with correct author/role | `server/tests/lab-03/comments-notes.api.test.ts` | Pending |
| API-15 | API | AC-12 | POST Internal Note as IT Staff, then GET /api/tickets/:id as the owning Requester | Note never appears in the Requester-facing response | `server/tests/lab-03/comments-notes.api.test.ts` | Pending |
| API-16 | API | BR-26 | POST comment/note with whitespace-only content | 400; nothing stored | `server/tests/lab-03/comments-notes.api.test.ts` | Pending |
| API-17 | API | AC-13 | POST resolved-confirmation as owning Requester, then GET ticket as IT Staff | requesterConfirmedResolved true; currentStatus unchanged | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pending |
| API-18 | API | AC-14 | GET /api/staff/tickets with search/filter/sort/page across 40+ seeded tickets | Returned subset/order/pagination match query params | `server/tests/lab-03/staff-queue.api.test.ts` | Pending |
| API-19 | API | AC-15 | POST /api/admin/users with an existing email | 409; field=email; no duplicate row | `server/tests/lab-03/users-admin.api.test.ts` | Pending |
| API-20 | API | AC-16 | POST reset-password, then login with the new password | mustChangePassword true on the next /api/auth/me | `server/tests/lab-03/users-admin.api.test.ts` | Pending |
| API-21 | API | AC-17 | PATCH self isActive=false as the sole active Administrator; PATCH last Administrator's role away | Both return 409 | `server/tests/lab-03/users-admin.api.test.ts` | Pending |
| API-22 | API | BR-28/BR-30 | POST/PATCH admin users with invalid role value | 400 | `server/tests/lab-03/users-admin.api.test.ts` | Pending |
| REGR-01 | Regression | AC-20 | Full Lab 2 Create-Ticket/My-Tickets/Attachments Supertest suite, adapted to use an authenticated Requester session instead of X-Requester-Id | All Lab 2 assertions still pass unmodified | `server/tests/lab-03/requester-regression.api.test.ts` | Pending |
| UI-01 | UI | AC-01/AC-02 | Login form valid + invalid submit | Empty submit shows field errors and doesn't call the API; invalid credentials show a single generic banner; busy state shown while pending | `client/tests/lab-03/Login.test.tsx` | Pass |
| UI-02 | UI | BR-07 | Change Password live rule checklist | Each rule icon flips to check as satisfied; Continue disabled until all pass; wrong current password shows a safe error and clears that field | `client/tests/lab-03/ChangePassword.test.tsx` | Pass |
| UI-03 | UI | Sec. 6 | Role-based nav renders only permitted links for each of the 3 roles | Requester/IT Staff/Administrator each see the correct, and only the correct, nav items | `client/src/.../AppShell.test.tsx` | Pending |
| UI-04 | UI | AC-11 | Add Public Comment in Requester Ticket Detail | New comment appears in the thread immediately | `client/src/.../RequesterTicketDetail.test.tsx` | Pending |
| UI-05 | UI | Sec. 7 | IT Staff Ticket Detail Public Comments vs Internal Notes tabs | Distinct styling/aria-label; switching tabs shows the correct content set | `client/src/.../StaffTicketDetail.test.tsx` | Pending |
| UI-06 | UI | AC-09 | Status dropdown in IT Staff Ticket Detail for a NEW ticket | Only matrix-valid next statuses appear as options | `client/src/.../StaffTicketDetail.test.tsx` | Pending |
| UI-07 | UI | Sec. 6 | Ticket Queue empty vs no-results states | Distinct copy/UI for 0-system-wide-tickets vs 0-matches-for-filter | `client/src/.../StaffTicketQueue.test.tsx` | Pending |
| UI-08 | UI | AC-15/AC-17 | User Management create-duplicate-email and self-deactivate attempts | Inline field error / inline toggle-revert message shown, no request loop | `client/src/.../UserManagement.test.tsx` | Pending |
| STYLE-01 | UI Style | Sec. 1 | Role and status badge color classes | Correct class per role/status value; text label always present | `client/src/.../badges.test.tsx` | Pending |
| RESP-01 | Responsive | Sec. 10 | Login + Ticket Queue + Staff Ticket Detail + User Management screenshots at 1280/900/375px | No clipping, overlap, or horizontal scroll at any viewport | `artifacts/lab-03/screenshots/**/*.png` via `e2e/lab-03/visual.spec.ts` | Pending |
| E2E-01 | E2E | AC-01, AC-03 | Login with a mustChangePassword seed account, change password, reach the authenticated shell | Redirect sequence completes; role-correct home screen shown | `e2e/lab-03/authentication.spec.ts` | Pending |
| E2E-02 | E2E | AC-19 | Log out, then attempt to open My Tickets directly by URL | Redirected to Login, no protected data flashes on screen | `e2e/lab-03/authentication.spec.ts` | Pending |
| E2E-03 | E2E | AC-07, AC-09, AC-11, AC-12 | Full IT Staff flow: log in, open Queue, claim a ticket, set IT Priority, walk one valid status transition, post a Public Comment and an Internal Note, verify Requester login cannot see the Note | Each step succeeds/fails exactly as specified end-to-end | `e2e/lab-03/staff-ticket-flow.spec.ts` | Pending |
| E2E-04 | E2E | AC-15, AC-16, AC-17 | Full Administrator flow: create user (duplicate-email rejected, then unique succeeds), edit, reset password, attempt self-deactivation (blocked) | Each step succeeds/fails exactly as specified end-to-end | `e2e/lab-03/user-administration.spec.ts` | Pending |
| E2E-05 | E2E | AC-20 | Re-run the Lab 2 create-ticket/my-tickets E2E flow logged in as an authenticated Requester | Identical outcomes to the Lab 2 spec, no Development Requester selector present | `e2e/lab-03/requester-regression.spec.ts` | Pending |

## 3. Acceptance-Criterion Traceability

| AC | Covered by |
|---|---|
| AC-01 | API-01, UI-01, E2E-01 |
| AC-02 | API-02, UI-01 |
| AC-03 | API-03, E2E-01 |
| AC-04 | API-05 |
| AC-05 | API-06 |
| AC-06 | API-07, E2E-03 |
| AC-07 | API-09, E2E-03 |
| AC-08 | API-10 |
| AC-09 | API-11, UI-06, E2E-03 |
| AC-10 | API-12 |
| AC-11 | API-14, UI-04, E2E-03 |
| AC-12 | API-15, E2E-03 |
| AC-13 | API-17 |
| AC-14 | API-18 |
| AC-15 | API-19, UI-08, E2E-04 |
| AC-16 | API-20, E2E-04 |
| AC-17 | API-21, UI-08, E2E-04 |
| AC-18 | API-08 |
| AC-19 | API-04, E2E-02 |
| AC-20 | REGR-01, E2E-05 |

## 4. Responsive and Visual Checklist
To be completed during the responsive/visual-QA Issue, recorded here with
screenshot evidence under `artifacts/lab-03/screenshots/`:
- [ ] Role-based navigation correct at all 3 viewports, for all 3 roles
- [ ] Login / Change Password usable at all 3 viewports
- [ ] Ticket Queue desktop table / mobile card both usable, no overflow
- [ ] Staff Ticket Detail: Public Comments vs Internal Notes visually
      distinct at all 3 viewports
- [ ] User Management modal usable at all 3 viewports
- [ ] No clipped labels, overlapping messages, or unintended horizontal
      scrolling anywhere
- [ ] Full Lab 2 responsive checklist (`docs/lab-02/tests.md` §4) still
      passes unmodified

## 5. Test Commands
```bash
# Backend unit + API tests
cd server && npm test

# Frontend unit/UI tests
cd client && npm test

# E2E + visual (from repo root, dev servers running)
npx playwright test e2e/lab-03
```

## 6. Final Results
_To be filled in once implementation is complete and all tests are run
against the final `main` branch — pass/fail status per Test ID above._

## 7. Known Limitations or Deferred Tests
- Actions Taken, password-reset email, and MFA are out of Lab 3 scope
  (Section 4.2 of the handout) and have no corresponding tests here.
- Load/performance testing of the Ticket Queue at large data volumes is not
  covered; only functional correctness at the 40+ seeded-ticket scale
  (API-18) is tested.
