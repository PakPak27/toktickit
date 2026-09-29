# Lab 3 — AI Use and Reflection

**LLM/agent used:** Claude Code (Anthropic), used via the CLI inside VS Code,
guided step-by-step through the full Spec-Driven Development → Test-Driven
Development → implementation → peer-review workflow, one GitHub Issue at a
time on its own feature branch, each merged into `lab3-staging` only after
review from my partner (Sirazaza).

## Selected key prompts (6–10)

| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | Shared the Lab 1/Lab 2 report and labsheet PDFs, then asked to continue into Lab 3, with an explicit rule: work one Issue at a time, open a PR for review after each, wait for my reviewer's comments, and only start the next Issue once I confirm the previous PR is actually merged | Set up the `docs/lab-03/` Spec-DD contract, the `TokTickIT-Lab3` GitHub Project board, and a feature-branch-per-Issue workflow before writing any implementation code |
| 2 | Asked for `specification.md`/`ui-spec.md`/`api-spec.md`/`tests.md` covering the new auth model, role-based authorization, and the IT Staff/Administrator screens | Reviewed the full document before opening the PR; my reviewer (PR #29) caught three real gaps on paper before any code existed: CORS/credentials never addressed even though the whole session-cookie design depends on it, an ambiguity where the status-transition matrix implied claiming a ticket auto-changed its status (contradicting BR-14/15), and a stale `DELETE` reference in the API summary table. Fixed the first two by adding an explicit CORS/credentials paragraph and decoupling claim from status transition in `api-spec.md`/`specification.md`; investigated the third against our actual code before pushing back — confirmed the endpoint genuinely was `DELETE` in our repo, so no change was needed there |
| 3 | Asked for the authentication foundation: `User` model/migration, bcrypt password hashing, JWT session cookie, login/logout/current-user, first-login password-change gate | My reviewer (PR #36) found two real bugs: an imperative `navigate("/tickets")` after login that raced with the component's own declarative `mustChangePassword` guard (not exploitable since `RequireAuth` caught it a beat later, but a real route-flash bug untested by the existing suite), and a timing side-channel where the unknown-email/inactive-account login path skipped `bcrypt.compare` entirely, making response time distinguish "account doesn't exist" from "wrong password." Fixed both — removed the imperative redirect entirely in favor of the declarative guard, and added a `DUMMY_PASSWORD_HASH` constant-time comparison — with new regression tests for each |
| 4 | Asked for the IT Staff Ticket Queue (search/filter/sort/pagination/owner-filter across all Requesters) | My reviewer (PR #38) found that `categoryId`/`itPriority` query params weren't validated before hitting Prisma, causing a 500 on a malformed value, unlike the adjacent `currentStatus` filter which already guarded against this. Fixed with shared validation constants; while fixing it I found and proactively fixed the *identical* pre-existing bug on the Lab 2 Requester ticket-list endpoint, which had never been caught until this review prompted a closer look |
| 5 | Asked for IT Staff Ticket operations: claim/reassign ownership, IT Priority, the full status-transition workflow, and Internal Notes kept separate from Public Comments | My reviewer (PR #39) found the `PATCH .../owner` endpoint returned an inconsistent response shape between the assign and unassign branches (only one included an extra `currentStatus` field), contradicting `api-spec.md`. Fixed to return the same shape from both branches |
| 6 | Asked for Administrator user management: create/edit/activate/deactivate/reset-password with duplicate-email, self-deactivation, and last-active-Administrator safety rules | My reviewer (PR #40) flagged that the suggested-temp-password generator used `Math.random()` instead of a cryptographically secure source. Fixed with a `crypto.getRandomValues()`-based helper, keeping the same password-rule guarantees |
| 7 | Asked for a full Playwright E2E suite plus a final responsive/visual QA pass across all three roles at desktop/tablet/mobile, to close out Lab 3 | While building this suite myself (not from a reviewer comment), I found and fixed two real production bugs on my own: `Login.tsx`'s "already authenticated" redirect still pointed non-`mustChangePassword` users to the Requester-only `/tickets` route — a stale leftover from before multi-role home routing existed, silently sending every IT Staff/Administrator login into a 403 for the entire dev cycle since Issue #31 — and `UserManagement.tsx`'s table caused page-level horizontal scroll on the 375px mobile viewport. Fixed both, with new regression coverage for the redirect bug and a Bootstrap `table-responsive` fix for the overflow |
| 8 | After each PR merged, asked to move straight to the next Issue only once I confirmed the merge myself, rather than assuming it was safe to proceed | This shaped the whole session structure: I never opened a new feature branch until the user explicitly said the previous PR had been reviewed and merged, keeping the Issue-by-Issue discipline the course requires even across long working sessions |

## Reflection

Lab 3's Spec-DD phase paid off in a very similar way to Lab 2's: the CORS/
credentials gap and the claim-vs-status-transition ambiguity in `specification.md`
were both caught on paper by my reviewer before any code existed, which meant
neither turned into a runtime bug later. What was different about Lab 3 was
how much of the actual authentication and authorization logic was
security-sensitive in ways that are easy to get subtly wrong without a second
pair of eyes — the login timing side-channel is the clearest example. The
code "worked" in every functional test (right user, right password, right
error message), and the bug was only a response-time difference invisible to
anyone just clicking through the app; it took a reviewer specifically
thinking about what an attacker could infer, not just what a user could
break, to catch it.

The most interesting bug of the whole lab, though, was one neither the
automated test suite nor my reviewer caught: `Login.tsx`'s post-login
redirect had been hardcoded to `/tickets` since before role-based home
screens existed, and nobody updated it when IT Staff and Administrator
homes were added in later Issues. Every unit test for `Login.tsx` only ever
used a `REQUESTER` role, so the bug was invisible to them by construction —
and it never showed up in manual testing either, because manual testing
during each Issue's own PR naturally focused on that Issue's own role. It
only surfaced once I wrote a real end-to-end suite that logged in as all
three roles and checked where they actually landed. That's a strong argument
for why the labsheet requires full E2E coverage as its own separate,
final Issue rather than treating "the unit tests pass" as equivalent to "the
app works" — a bug can hide for an entire multi-week development cycle
behind role-scoped unit tests and role-scoped manual QA, and only show up
once someone tests the seams between roles.
