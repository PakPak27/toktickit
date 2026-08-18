# Lab 2 Test Plan and Results

## 1. Test Strategy
Tests are planned before implementation (Test DD) and written to fail first, then made to
pass while implementing each Issue (TDD). Every Acceptance Criterion in `specification.md`
maps to at least one automated test below. Coverage spans: unit (pure logic), API/integration
(Supertest against the Express app + real test DB), UI component (Vitest + Testing Library),
responsive/visual (Playwright screenshots at 3 viewports), and E2E (Playwright, full flow
against a running dev server).

## 2. Planned Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| UNIT-01 | Unit | BR-01 | Ticket Number generator produces `TKT-YYYY-NNNNNN` and increments | Format matches regex; sequential per year | `server/tests/lab-02/ticket-number.unit.test.ts` | Pending |
| UNIT-02 | Unit | BR-15/BR-16 | Summary/Description trimming + length validation helper | Rejects <5/<10 chars and >120/>2000 chars; trims whitespace | `server/tests/lab-02/validation.unit.test.ts` | Pending |
| API-01 | API | AC-01 | POST /api/tickets with valid data | 201; ticket saved; response includes generated ticketNumber | `server/tests/lab-02/create-ticket.api.test.ts` | Pending |
| API-02 | API | AC-04 | POST /api/tickets with empty Summary | 400; field-level validation error; no row inserted | `server/tests/lab-02/create-ticket.api.test.ts` | Pending |
| API-03 | API | AC-03 | GET /api/tickets/:id for a ticket owned by a different requesterId | 403/404; no ticket data returned | `server/tests/lab-02/ticket-detail.api.test.ts` | Pending |
| API-04 | API | AC-11 | GET /api/tickets scoped per requesterId | Only the requesting Requester's own tickets returned | `server/tests/lab-02/my-tickets.api.test.ts` | Pending |
| API-05 | API | AC-13 | GET /api/tickets?page=2&pageSize=10 | Correct subset + pagination metadata (total, page, pageSize) | `server/tests/lab-02/my-tickets.api.test.ts` | Pending |
| API-06 | API | AC-14 | GET /api/tickets?sort=createdAt&order=asc | Tickets ordered oldest-first | `server/tests/lab-02/my-tickets.api.test.ts` | Pending |
| API-07 | API | AC-12 | GET /api/tickets?search=zzzznomatch | Empty array; total=0 (drives no-results UI state) | `server/tests/lab-02/my-tickets.api.test.ts` | Pending |
| API-08 | API | AC-07 | POST /api/tickets/:id/attachments with a 6MB file | 400; rejected before storage; no DB row created | `server/tests/lab-02/attachments.api.test.ts` | Pending |
| API-09 | API | AC-08 | POST attachment when ticket already has 5 active attachments | 400/409; 6th attachment rejected | `server/tests/lab-02/attachments.api.test.ts` | Pending |
| API-10 | API | AC-09 | GET /api/attachments/:id/download for an active attachment | 200; correct file bytes/content-type returned | `server/tests/lab-02/attachments.api.test.ts` | Pending |
| API-11 | API | AC-10 | DELETE /api/attachments/:id with reason, then GET download | DELETE succeeds (soft); subsequent download returns 410 | `server/tests/lab-02/attachments.api.test.ts` | Pending |
| API-12 | API | BR-10 | Any ticket/attachment endpoint without X-Requester-Id header | 400/401; ownership cannot be bypassed | `server/tests/lab-02/ownership.api.test.ts` | Pending |
| UI-01 | UI | AC-02 | My Tickets/Create Ticket opened with no Requester selected | Redirects to Requester Selection screen | `client/src/.../RequesterGuard.test.tsx` | Pending |
| UI-02 | UI | FR-01/FR-02 | Requester dropdown loads active Requesters; Change Requester works | Dropdown populated from API; switching reloads current-Requester display | `client/src/.../RequesterSelection.test.tsx` | Pending |
| UI-03 | UI | AC-04 | Submit Create Ticket form with empty Summary | Inline field message shown; API not called | `client/src/.../CreateTicket.test.tsx` | Pending |
| UI-04 | UI | BR-19 | Rapid double-click Submit on valid form | Only one API call fires; button shows busy/disabled state | `client/src/.../CreateTicket.test.tsx` | Pending |
| UI-05 | UI | AC-06 | Create Ticket submit while API mocked to fail | Safe error message shown; all field values retained | `client/src/.../CreateTicket.test.tsx` | Pending |
| UI-06 | UI | AC-07 | Select a 6MB file in the attachment picker | Inline error shown; file not added to upload list | `client/src/.../AttachmentSection.test.tsx` | Pending |
| UI-07 | UI | BR-30/AC-12 | My Tickets with 0 tickets vs. search with 0 matches | Distinct empty-state vs. no-results-state messaging/UI | `client/src/.../MyTickets.test.tsx` | Pending |
| UI-08 | UI | AC-11 | My Tickets re-fetches when current Requester changes | List updates to show only the newly selected Requester's tickets | `client/src/.../MyTickets.test.tsx` | Pending |
| UI-09 | UI | AC-10 | Ticket Detail renders a removed attachment | Shows "Removed" badge/reason; Download control disabled | `client/src/.../RequesterTicketDetail.test.tsx` | Pending |
| STYLE-01 | UI Style | Sec. 8.3 | Required-field asterisk + validation message placement | Asterisk present; message renders directly under its field, not only at top | `client/src/.../CreateTicket.test.tsx` | Pending |
| STYLE-02 | UI Style | Sec. 7 (Zen Green) | Badge color classes for Requested Priority / Status | Correct CSS class per value (no reliance on color alone; text label present) | `client/src/.../badges.test.tsx` | Pending |
| RESP-01 | Responsive | Sec. 8.7 | Create Ticket screenshot at 1280px / 900px / 375px | No clipped labels, no horizontal scroll, fields stack correctly on mobile | `artifacts/lab-02/screenshots/create-ticket/*.png` via `e2e/lab-02/visual.spec.ts` | Pending |
| RESP-02 | Responsive | Sec. 8.7 | My Tickets screenshot at 1280px / 900px / 375px | Desktop table vs. mobile card layout both usable, no overflow | `artifacts/lab-02/screenshots/my-tickets/*.png` via `e2e/lab-02/visual.spec.ts` | Pending |
| RESP-03 | Responsive | Sec. 8.7 | Ticket Detail screenshot at 1280px / 900px / 375px | Header fields and attachment section remain distinct and readable at all sizes | `artifacts/lab-02/screenshots/ticket-detail/*.png` via `e2e/lab-02/visual.spec.ts` | Pending |
| E2E-01 | E2E | AC-01, AC-05 | Full flow: select Requester → fill Create Ticket → submit on mobile viewport | Confirmation shows official Ticket Number; no layout issues | `e2e/lab-02/create-ticket.spec.ts` | Pending |
| E2E-02 | E2E | AC-11 | Full flow: create ticket as Requester A, switch to Requester B, open My Tickets | Requester A's ticket is not visible to Requester B | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pending |
| E2E-03 | E2E | AC-09, AC-10 | Full flow: open Ticket Detail → add attachment → download it → remove it → verify blocked download | Each step succeeds/fails exactly as specified | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pending |

## 3. Acceptance-Criterion Traceability

| AC | Covered by |
|---|---|
| AC-01 | API-01, E2E-01 |
| AC-02 | UI-01 |
| AC-03 | API-03 |
| AC-04 | API-02, UI-03 |
| AC-05 | E2E-01 |
| AC-06 | UI-05 |
| AC-07 | API-08, UI-06 |
| AC-08 | API-09 |
| AC-09 | API-10, E2E-03 |
| AC-10 | API-11, UI-09, E2E-03 |
| AC-11 | API-04, UI-08, E2E-02 |
| AC-12 | API-07, UI-07 |
| AC-13 | API-05 |
| AC-14 | API-06 |
| AC-15 | UI-02 |

## 4. Responsive and Visual Checklist
To be completed during Issue #6 (Responsive and visual QA), checked against `ui-spec.md`:
- [ ] No clipped labels at any viewport
- [ ] No overlapping validation messages
- [ ] No unintended horizontal scrolling on mobile
- [ ] Consistent field styling (editable vs. read-only vs. error) across all three screens
- [ ] All loading/empty/no-results/error states present and styled per `ui-spec.md`
- [ ] Badge colors consistent for Requested Priority, IT Priority, and Current Status
- [ ] Filters, pagination, and attachment controls remain usable at all viewport sizes

## 5. Test Commands

```bash
# Server (unit + API)
cd server && npm run test

# Client (UI + UI style)
cd client && npm run test

# E2E + responsive/visual (Playwright)
npx playwright test e2e/lab-02
```

## 6. Final Results
*(To be filled in once all Issues are implemented and merged to `main` — will show final
pass counts per suite, matching the Definition of Done requirement that all tests pass on
the final `main` branch.)*

## 7. Known Limitations or Deferred Tests
- Concurrency edge cases (e.g., two simultaneous ticket creations racing on the sequential
  Ticket Number counter) are not covered by automated tests in Lab 2; the generator is
  expected to use a DB-level safe increment, but a dedicated concurrency test is deferred.
- Cross-browser Playwright runs are limited to Chromium in Lab 2 for time; Firefox/WebKit
  are not exercised.