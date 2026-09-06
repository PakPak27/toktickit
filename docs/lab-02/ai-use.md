# Lab 2 — AI Use and Reflection

**LLM/agent used:** Claude (Anthropic), used via web chat interface, guided step-by-step
through terminal/VS Code across the full Spec-Driven Development → Test-Driven
Development → implementation workflow.

## Selected key prompts (6–10)

| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | Asked for a full plan/roadmap for Lab 2 before starting anything, since the scope (spec docs + 5 feature Issues) was much larger than Lab 1 | Reviewed the 7-phase plan, then decided to start with Phase 0 (branch/board setup) before touching any documentation |
| 2 | Asked for help writing `specification.md` — business rules, data model, and acceptance criteria not explicitly given in the handout | Reviewed all BR-01 through BR-33 and every AC before approving; made two explicit design decisions myself when asked (localStorage for Requester persistence, file-on-disk for attachment storage) rather than accepting defaults blindly |
| 3 | After my reviewer commented that `specification.md` didn't specify exact seed-data minimums (6+ Related Systems, 4+ active/1 inactive Requester) from the labsheet, asked how to fix it | Added an explicit "Required Seed Data" subsection to Section 7, cross-referencing the labsheet section number |
| 4 | After the same reviewer noticed BR-26/`tests.md` said "410/403" while `api-spec.md` only documented 403, asked to resolve the inconsistency | Standardized on 410 (Gone) specifically for soft-removed attachments, reserving 403 strictly for ownership failures, and updated all three docs (spec, tests, api-spec) to match |
| 5 | Asked for the `POST /api/tickets` implementation and Ticket Number generator (BR-01) | Reviewed the count-then-increment approach; later this exact design caused a real race-condition bug — see reflection below |
| 6 | After my reviewer independently found (and fixed the same way in their own repo) a duplicate ticket-number bug from parallel test execution, asked how to make the generator collision-safe | Implemented `createTicketWithRetry()` catching Prisma's P2002 error and retrying with a fresh number, plus set `fileParallelism: false` in `vitest.config.ts` since all API tests hit the same real dev database |
| 7 | Asked for the My Tickets UI (search/filter/sort/pagination) matching `ui-spec.md` Section 13 | After merging, my reviewer pointed out three real gaps against our own spec: no page-size selector, no sort-direction arrow, no mobile sort control — none of which the test suite had caught. Fixed all three and added tests for each |
| 8 | Asked why an attachment "Download" button was returning a JSON error instead of downloading a file | Learned that a plain `<a href>` cannot attach a custom header (`X-Requester-Id`), which our ownership check depends on; fixed by fetching the file as a Blob via `fetch()` and triggering the download through a temporary object URL instead |

## Reflection

Working with an AI coding agent on Lab 2 felt very different from Lab 1 because of the
Spec-Driven Development requirement — writing `specification.md`, `tests.md`, `ui-spec.md`,
and `api-spec.md` *before* any code existed meant most ambiguities got caught on paper,
by my reviewer, rather than in code review later. The two most valuable moments weren't
when the AI got something right on the first try, but when review comments (both mine and
my partner's) caught real gaps: an inconsistent HTTP status code across three documents,
and three UI-spec requirements (page-size selector, sort arrows, mobile sort control) that
were fully documented but silently never implemented. Neither gap was caught by the
automated test suite, which was itself a useful lesson — tests only verify what someone
thought to test.

The most technically interesting bug was the ticket-number race condition: the generator
worked perfectly under normal manual testing, but broke under concurrent automated test
runs because two test files created tickets against the same real database at the same
time. What made this a strong AI-collaboration moment was that my reviewer's team hit and
fixed the *exact same bug the same way* (retry-on-unique-constraint-collision) independently,
while testing their own Create Ticket flow — good outside confirmation that this was a real
issue worth fixing, not overkill.