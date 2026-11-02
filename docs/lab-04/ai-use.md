# Lab 4 — AI Use and Reflection

**LLM/agent used:** Claude Code (Anthropic), used via the CLI inside VS Code,
guided step-by-step through the same Spec-Driven Development → Test-Driven
Development → implementation → peer-review workflow as Labs 2–3: one GitHub
Issue at a time on its own feature branch, each merged into `lab4-staging`
only after review from my partner (Sirazaza).

## Selected key prompts (8–10)

| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | Shared the Lab 4 labsheet PDF and asked to continue straight into Lab 4, same rules as before: one Issue at a time, PR for review after each, only start the next once I confirm the previous one merged | Set up `docs/lab-04/` Spec-DD contract, a new `TokTickIT-Lab4` GitHub Project board, and six Issues matching the labsheet's decomposition — caught and fixed two of my own board-setup mistakes along the way (issues landing with no Status at all, and new Issues auto-added to the old Lab 1/Lab 2 boards by a leftover "Auto-add" workflow on those projects) |
| 2 | Asked for the Actions Taken foundation: schema, API (create/edit/list for staff, read-only for the Requester), optimistic concurrency on edits | My reviewer found a real bug: a partial `PATCH` that only sent `followUpNote` could leave `followUpRequired: true` with an empty note, because validation only checked whichever of the two fields that specific request happened to send, not what the record would actually end up with. Fixed by validating the *effective* values after the edit; also fixed the 409 conflict body to match `api-spec.md` and closed a check-then-write race in the stale-edit check by making it one atomic `updateMany`. While building this I also found the project's own seed script never seeded any Tickets at all — the "373 tickets" I'd been seeing in dev were purely accumulated from repeated manual test runs, not reproducible on a fresh clone — so I added real Ticket + Actions Taken seed data covering every status and follow-up combination the labsheet asks for |
| 3 | Asked for the Actions Taken UI: list, add form, inline edit, conflict handling | My reviewer found that clearing the Attachment Notes field on an edit was silently ignored — the client sent `undefined` instead of an empty string when the box was emptied, and the PATCH handler only updates a field when it's present in the body. Fixed by always sending the trimmed value, never falling back to `undefined` |
| 4 | Asked for the Ticket workflow: the resolution gate (BR-11/BR-12) and optimistic concurrency on status changes (BR-14) | Implemented the gate and the atomic stale-update check myself this time, learning directly from my reviewer's feedback on Issue #47's equivalent bug. While implementing it I found two inaccuracies in my own `api-spec.md` from the Spec-DD Issue — it documented `INVALID_TRANSITION` as a `409` case when Lab 3's actual, unchanged code has always returned `400`, and it undersold the `200` response shape — and corrected the doc rather than the already-correct code |
| 5 | Asked for the Requester and IT Staff/Administrator dashboards, with every metric card linking into a pre-filtered list | Built the two dashboard screens, the `statusGroup=active` drill-down filter, and the URL-param-reading My Tickets/Ticket Queue needed to land pre-filtered. While testing this I found a real bug unrelated to dashboards: `ticketNumber.ts` generated the next sequence from a row *count*, not the highest existing number — since nothing else changes between retry attempts, a single Ticket deletion anywhere (my own test cleanup, in this case) left every later create recomputing the same already-taken number and exhausting its retries, breaking ticket creation entirely until fixed to `MAX(existing)+1` |
| 6 | Asked to review several of my partner's PRs on his own repo in the same order he opened them | Found and reported (not fixed, since it's his code) one real reciprocal issue: his `parseId` helper had the identical missing-upper-bound gap he'd flagged on mine the round before, now duplicated across every Lab 4 route since he'd since extracted it into one shared file — he fixed it in his next commit. Later PRs in his stack (the resolution-gate transaction, the status history) were thorough enough that I had nothing left to flag beyond one cosmetic nit |
| 7 | Asked for Final Hardening: close out the one still-`Pending` planned unit test, run the full regression suite, build the Lab 4 E2E/visual suite, update the README, and write these two documents | Extracted the resolution-gate logic (until then inline in the status route) into a standalone pure function so it could actually be unit-tested as the original test plan specified. Building the E2E suite surfaced three more pre-existing issues, none in Lab 4's own application code: Lab 3's E2E specs assumed login lands directly on a role's list screen, which Lab 4's new Dashboard-as-landing-page deliberately changed; the new "View Ticket Queue" dashboard button made an existing unqualified link query ambiguous; and two *different* Supertest files each left a throwaway Administrator/IT-Staff-role test user behind with no cleanup, which other files' unordered `findFirst` lookups for "the seeded" account could non-deterministically pick up instead — it broke unrelated regression files more than once in the same session before I traced it to its root cause and fixed it everywhere the same pattern appeared |
| 8 | After each PR merged, asked to move straight to the next Issue only once told the previous one had actually been reviewed and merged — same discipline as every earlier lab | Never opened a new feature branch speculatively; always waited for explicit confirmation, even across a very long single working session covering all six Lab 4 Issues plus five rounds of cross-repo peer review |
| 9 | Asked to act on my partner's `CHANGES_REQUESTED` review of Final Hardening (Issue #51) | His one blocking finding: my own fix for his earlier Issue #49 non-blocking note (wrapping the stale check, resolution gate, and status write in one `$transaction`) didn't actually close the race against a concurrent Action Taken write, because Postgres's default READ COMMITTED isolation takes no lock on rows a transaction only reads. Took his suggested fix instead — every Action Taken write now also bumps the Ticket's own `updatedAt`, so the status route's pre-existing optimistic-concurrency check catches it — and traced through the interleavings myself to confirm it, rather than applying the suggestion on faith |

## Reflection

The most striking pattern across Lab 4 was how often a bug turned out to live
*outside* the feature I was actually building. Issue #47's missing Ticket
seed data, Issue #50's ticket-number generator, and Final Hardening's test-
pollution chain were all discovered as side effects of building something
else — a resolution gate, a dashboard, an E2E suite — not because I set out
to audit them. That's consistent with Lab 3's biggest lesson (the stale
`/tickets` redirect only surfaced once someone tested the seams between
roles), but Lab 4 showed a sharper version of it: a *test* can be the thing
that breaks a shared resource for every other test, not just the app code
under test. My own `afterAll` cleanup for a new dashboard test file deleted
a Ticket for the first time in this project's history, which exposed that
`ticketNumber.ts` had never been built to tolerate a gap in the sequence —
a latent bug that had simply never been exercised because nothing had ever
deleted a Ticket before.

The peer-review exchanges stayed just as valuable as in Lab 3, but the
*content* of what got caught shifted. Lab 3's reviewer comments were mostly
about things a careful reading of the spec would catch — an unvalidated
filter, an inconsistent response shape. Lab 4's two real bugs from review
(the partial-PATCH validation gap, the silently-dropped Attachment Notes
clear) both needed the reviewer to think about *sequences of requests*
rather than any single request in isolation — what happens on the *second*
edit, not the first. That tracks with Lab 4 being fundamentally about state
that changes over time (a Ticket's status history, an Action's lifecycle)
rather than Lab 3's more static authorization model, and it's the same
reason BR-13/BR-14's optimistic-concurrency checks exist in the first place.

Finally, reviewing my partner's independent implementation of the same
labsheet was its own kind of regression test: his resolution-gate PR wrapped
the stale-check, the gate, and the history write in one database
transaction, which at the time looked like a cleaner solution to a problem
I'd handled less elegantly with a standalone atomic `updateMany` on my own
equivalent endpoint. Final Hardening's review from him corrected that
impression, though — wrapping a read-gate-write sequence in one
`$transaction` doesn't by itself stop a *different* transaction (an Action
Taken write, touching a different table) from committing in between, since
Postgres's default READ COMMITTED isolation takes no lock on rows a
transaction only reads. He confirmed his own endpoint has the identical gap.
The actual fix needed understanding the isolation level, not just reaching
for `$transaction` as a reflex — a sharper and more useful lesson than the
one I'd drawn the first time around.
