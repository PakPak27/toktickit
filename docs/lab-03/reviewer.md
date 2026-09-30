# Lab 3 — Peer Review Record

**Author:** Chanaphath Malilert — 67070503462 — GitHub: @PakPak27
**Peer reviewer:** Punyawat Sookarsa — 67070503468 — GitHub: @Sirazaza

## Pull Requests I authored (reviewed by my partner)

| PR | Branch | Issue | Reviewer verdict |
|----|--------|-------|------------------|
| https://github.com/PakPak27/toktickit/pull/29 | feature/lab3-1-spec-and-tests | #28 Spec-DD engineering contract | Changes requested (CORS/credentials, claim-vs-status ambiguity), then Approved |
| https://github.com/PakPak27/toktickit/pull/36 | feature/lab3-2-auth-foundation | #30 Authentication foundation | Changes requested (login redirect race, login timing side-channel), then Approved |
| https://github.com/PakPak27/toktickit/pull/37 | feature/lab3-3-requester-regression | #31 Requester regression | Approved, no comments |
| https://github.com/PakPak27/toktickit/pull/38 | feature/lab3-4-staff-queue | #32 IT Staff Ticket Queue | Changes requested (unvalidated categoryId/itPriority filters), then Approved |
| https://github.com/PakPak27/toktickit/pull/39 | feature/lab3-5-staff-ticket-detail | #33 IT Staff Ticket operations | Approved (with a non-blocking nit on response-shape consistency) |
| https://github.com/PakPak27/toktickit/pull/40 | feature/lab3-6-admin-users | #34 Administrator user management | Approved (with a non-blocking nit on password-generation RNG) |
| https://github.com/PakPak27/toktickit/pull/41 | feature/lab3-7-responsive-visual-qa | #35 Responsive & visual QA | Approved, no comments |
| https://github.com/PakPak27/toktickit/pull/42 | lab3-staging → main | Release | Approved (merged without further comments) |

### Issue #28 (Spec-DD engineering contract) review
**Reviewer comment I received:** Punyawat found three gaps on paper before any
code existed: (1) CORS/credentials were never addressed even though the
entire session-cookie auth design depends on them — Lab 2's `cors()` default
wildcard origin silently breaks credentialed cookies with no visible error;
(2) the status-transition matrix's `(claim)` annotation on `NEW → OPEN`
implied claiming a ticket auto-changes its status, contradicting BR-14/BR-15
and the claim endpoint's own documented response shape; (3) `api-spec.md`'s
endpoint summary table listed the attachment-removal endpoint as `DELETE`,
which he flagged as stale against a fix from an earlier Lab review.
**How I responded:** Added an explicit CORS/credentials paragraph to
`specification.md` §11 (explicit origin + `credentials: true` server-side,
`credentials: "include"` on every frontend `fetch`); decoupled claiming from
status transitions by removing the `(claim)` annotation and adding a
paragraph in §5.5 stating ownership and status changes are independent
operations. For the third point, I checked our actual code first rather than
changing the doc blindly — confirmed `server/src/app.ts` genuinely does use
`DELETE` for attachment removal in our repo, so the summary table was
accurate and no change was needed there; my reviewer agreed after checking
and approved.

### Issue #30 (Authentication foundation) review
**Reviewer comment I received:** Punyawat found two real bugs: (1)
`Login.tsx`'s `handleSubmit` called `navigate("/tickets")` unconditionally
after login, never checking the freshly-logged-in user's
`mustChangePassword`, unlike the component's own declarative render-time
guard which handled it correctly — not exploitable since `RequireAuth`
caught it a beat later, but a real route-flash bug that `Login.test.tsx`
never covered; (2) a timing side-channel on `POST /api/auth/login` where
the unknown-email/inactive-account path skipped `bcrypt.compare` entirely
while a wrong-password case always ran it, making response time leak
whether an email exists in the system, contradicting our own BR-01 intent.
**How I responded:** Removed the imperative `navigate("/tickets")` call
entirely, letting the declarative `mustChangePassword` guard be the sole
source of truth for the post-login destination, and added two regression
tests asserting the actual rendered destination for both
`mustChangePassword: true` and `false`. Added a `DUMMY_PASSWORD_HASH`
constant computed once at module load and always ran a `bcrypt.compare`
against either the real hash or the dummy one before checking
`!user || !user.isActive || !passwordOk`, so both code paths pay the same
cost.

### Issue #31 (Requester regression) review
**Reviewer comment I received:** Approved with no comments — "Nothing to
flag, looks good to merge from my side."
**How I responded:** Merged as-is.

### Issue #32 (IT Staff Ticket Queue) review
**Reviewer comment I received:** Punyawat found that `categoryId` and
`itPriority` query params on `GET /api/staff/tickets` weren't validated
before being passed to Prisma — an invalid value (`?categoryId=abc` or
`?itPriority=URGENT`) threw a Prisma error and returned 500, instead of
being ignored the way the adjacent `currentStatus` filter already was.
**How I responded:** Validated `categoryId` with `Number.isInteger` and
`itPriority` against the known enum values, the same way `currentStatus`
already was, via two shared constants (`KNOWN_PRIORITY_VALUES`/
`KNOWN_STATUS_VALUES`) used by both `GET /api/staff/tickets` and
`GET /api/tickets`. While fixing it I found the identical unvalidated-filter
defect already existed on the Lab 2 Requester ticket-list endpoint, so I
fixed that one in the same commit rather than leaving a known duplicate bug
in place, and added regression tests on both endpoints.

### Issue #33 (IT Staff Ticket operations) review
**Reviewer comment I received:** Approved with one non-blocking nit:
`PATCH /api/staff/tickets/:id/owner` returned an inconsistent response
shape — the unassign branch included an extra `currentStatus` field that
the assign branch didn't, and `api-spec.md` §12 only documented the latter.
No functional impact since the client ignores the response and refetches,
but the two branches should match.
**How I responded:** Made both branches return only `{ ticketOwner }`,
matching `api-spec.md` §12.

### Issue #34 (Administrator user management) review
**Reviewer comment I received:** Approved with one non-blocking nit:
`generatePassword()` in `UserManagement.tsx` used `Math.random()` instead of
a cryptographically secure source. Low practical risk since it's only a
suggested temp password the admin can edit before submitting (and it forces
`mustChangePassword` immediately), but worth using a crypto-secure source
for anything password-shaped.
**How I responded:** Rewrote `generatePassword()` to draw every character
(and the Fisher–Yates shuffle) from `crypto.getRandomValues()` via a small
`randomIndex()` helper, while still guaranteeing at least one lowercase,
uppercase, digit, and special character so the result always passes BR-07's
password-rule validator.

### Issue #35 (Responsive & visual QA) review
**Reviewer comment I received:** Approved with no comments — "Nothing to
flag, looks good to merge from my side."
**How I responded:** Merged as-is. (Two real bugs — a stale post-login
redirect and a mobile table-overflow bug — were found and fixed by me while
building this Issue's E2E suite, not by reviewer comment; see `ai-use.md`
for details.)

## Pull Requests I reviewed for my partner

### Sprint 3 engineering contract (Punyawat's implementation, `Sirazaza/toktickit_lab1#28`)
**My comment:** Flagged two gaps in the spec before implementation starts.
(1) The `PATCH /api/staff/tickets/:id/claim` endpoint takes an optional
`ticketOwnerId` and only validates that it's an active IT_STAFF/ADMINISTRATOR
— it never checks whether the ticket is already owned, or whether
`ticketOwnerId` is the caller's own id. BR-18 only covers self-claiming an
unassigned ticket and BR-19 only covers reassigning an already-owned one, so
neither rule says whether one staff member can directly hand an unclaimed
ticket to a different staff member — while `ui-spec.md` §6 only ever shows a
self-claim button until a ticket has an owner, implying the API is more
permissive than the UI or BRs intend. (2) BR-27 only clears the "appears
resolved" flag when the Requester posts a new Public Comment, with no rule
covering a ticket going `CLOSED → REOPENED` — so a stale "appears resolved"
hint could still show on a ticket that was just reopened specifically
because it wasn't actually resolved.
**Partner's response:** Agreed with both and fixed them in commit `0051bb8`.
(1) Added BR-19a: claiming an unassigned Ticket is self-claim only — a
`ticketOwnerId` that isn't the caller's own id is rejected with 400 while
the Ticket is unassigned, matching what `ui-spec.md` §6 actually exposes;
handing an unclaimed Ticket to a colleague now requires claiming it first,
then reassigning (BR-19). (2) Added BR-27a: reopening a Ticket into
`REOPENED` now also clears `appearsResolvedAt`. Added AC-21/AC-22 and the
corresponding tests (API-16a/API-25a) with traceability, then merged.
