# Lab 2 — Peer Review Record

**Author:** Chanaphath Malilert — 67070503462 — GitHub: @PakPak27
**Peer reviewer:** Punyawat Sookarsa — 67070503468 — GitHub: @Sirazaza

## Pull Requests I authored (reviewed by my partner)

| PR | Branch | Issue | Reviewer verdict |
|----|--------|-------|------------------|
| https://github.com/PakPak27/toktickit/pull/19 | feature/1-spec-and-tests | #13 Spec+Tests | Approved (after 2 rounds of fixes) |
| https://github.com/PakPak27/toktickit/pull/20 | feature/2-requester-context | #14 Requester context | Approved (after fixing missing UI-01 test coverage) |
| https://github.com/PakPak27/toktickit/pull/21 | feature/3-create-ticket | #15 Create Ticket | Approved (after fixing missing client-side files) |
| https://github.com/PakPak27/toktickit/pull/22 | feature/4-my-tickets | #18 My Tickets | Approved (after fixing page-size selector, sort arrows, mobile sort control) |
| https://github.com/PakPak27/toktickit/pull/23 | feature/5-ticket-detail-attachments | #16 Ticket Detail/Attachments | Approved (after fixing file leak, .gitignore glitch, and a restored-routes regression) |
| https://github.com/PakPak27/toktickit/pull/24 | feature/6-responsive-visual-qa | #17 Responsive QA | Approved (after fixing a missing vite.config.ts host setting) |
| https://github.com/PakPak27/toktickit/pull/25 | lab2-staging → main | Release | Approved |

### Issue #13 (Sprint 2 specification and test plan) review
**Reviewer comment I received:** Punyawat pointed out two gaps: (1) specification.md
didn't specify the labsheet's required seed-data minimums (6+ Related Systems, 4+
active/1 inactive Requester); (2) BR-26/tests.md said attachment download should
return "410/403" while api-spec.md only documented 403 — an inconsistency.
**How I responded:** Added an explicit "Required Seed Data" subsection referencing
the labsheet section number, and standardized on 410 (Gone) specifically for
soft-removed attachments, reserving 403 strictly for ownership failures — updated
specification.md, tests.md, and api-spec.md together to stay consistent.

### Issue #14 (Development Requester context) review
**Reviewer comment I received:** Punyawat asked whether UI-01 (`RequesterGuard.test.tsx`,
testing the redirect behavior for AC-02) had been forgotten or moved to another Issue,
since it wasn't in the PR despite being planned in tests.md.
**How I responded:** Confirmed it was genuinely missing, not moved. Added
`client/tests/lab-02/RequesterGuard.test.tsx` covering both the redirect-when-unselected
and render-when-selected cases for AC-02.

### Issue #15 (Create Ticket) review
**Reviewer comment I received:** Punyawat noted that a real-world diff check showed
only 9 server-side files in the PR — none of the client-side files (CreateTicket.tsx,
api/tickets.ts, CreateTicket.test.tsx) described in the PR body were actually present,
suggesting a `git add`/commit/push step was skipped.
**How I responded:** Confirmed the client files existed locally but were never staged
in the original commit (ran `git add` from the wrong directory). Pushed a follow-up
commit with all four missing client-side files.

### Issue #18 (My Tickets) review
**Reviewer comment I received:** Punyawat found three gaps against our own
ui-spec.md Section 13 that weren't implemented or tested: no page-size selector
(10/20/50) despite the API supporting it, no sort-direction arrow indicator on
column headers, and no mobile sort control since table headers aren't shown there.
**How I responded:** Added all three: a desktop page-size `<select>` wired to state
that previously had no setter, an ↑/↓ arrow computed from current sort/order state,
and an explicit mobile `<select>` for sort field + direction. Added three new tests
covering each behavior.

### Issue #16 (Ticket Detail and Attachments) review
**Reviewer comment I received:** Two rounds. First: a stray `git add ...` command
had leaked into `.gitignore` from a copy-paste accident, and the attachment upload
handler left orphaned files on disk on error paths (multer writes the file before
ownership/validation checks run, and not every failure path called `fs.unlink`).
Second (more serious): a regression where the entire attachment-related route set
(GET /api/tickets/:id, upload, download, soft-remove) had been accidentally wiped
from app.ts during the first fix, breaking the feature end-to-end.
**How I responded:** First round — wrapped the whole upload handler in try/catch
with a `cleanupFile()` helper called on every error path, and cleaned up the stray
`.gitignore` line. Second round — restored the full route set from scratch, verified
with `npm run test` that ticket-detail.api.test.ts and attachments.api.test.ts passed
again before pushing.

### Issue #17 (Responsive and visual QA) review
**Reviewer comment I received:** Punyawat noticed the PR description claimed a
`host: true` fix in `client/vite.config.ts` (needed for Playwright's Chromium to
connect via IPv4), but the actual file diff didn't include that change — meaning
`npx playwright test` might not actually pass on a machine where Vite only binds
to IPv6 by default, contradicting the "all 12 tests should pass" claim.
**How I responded:** Confirmed the fix had been made locally but lost during an
earlier stash/branch-recovery mix-up, and hadn't been verified afterward. Added
`host: true` to vite.config.ts and re-ran the full Playwright suite locally to
confirm all 12 tests genuinely passed before pushing.

## Pull Requests I reviewed for my partner

### My Tickets (Punyawat's implementation)
**My comment:** I noticed there was no "IT Priority" filter even though ui-spec.md
Section 13 specifies four dropdown filters (Category, Requested Priority, IT
Priority, Current Status) and the API/type already supported it. I also pointed out
there was no mobile sorting control despite the spec explicitly requiring one where
table headers aren't shown, and that pagination only had Previous/Next buttons with
text instead of the numbered page buttons the spec requires.

**Partner's response:** Agreed with all three and fixed them: added the missing IT
Priority filter dropdown, added a mobile sort control (table headers aren't shown
there so there was no way to change sort at all), and added numbered page buttons
instead of just Previous/Next. Added regression tests for each and pushed as a
single commit.