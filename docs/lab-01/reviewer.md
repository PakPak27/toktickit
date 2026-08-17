# Lab 1 — Peer Review Record

**Author:** Chanaphath Malilert — 67070503462 — GitHub: @PakPak27
**Peer reviewer:** Punyawat Sookarsa — 67070503468 — GitHub: @Sirazaza

## Pull Requests I authored (reviewed by my partner)

| PR | Branch | Reviewer verdict |
|----|--------|------------------|
| https://github.com/PakPak27/toktickit/pull/6 | feature/1-project-foundation | Approved |
| https://github.com/PakPak27/toktickit/pull/7 | feature/2-health-check | Approved (after one round of requested changes) |
| https://github.com/PakPak27/toktickit/pull/8 | feature/3-category-seed | Approved |
| https://github.com/PakPak27/toktickit/pull/9 | feature/4-category-list | Approved |

### Issue 1 review
**Reviewer comment I received:** Punyawat asked whether the README intentionally
omitted `npm run prisma:seed` from the setup steps, or if it was an oversight.
**How I responded:** Confirmed it was intentional — the `Category` model didn't
exist yet in this PR (Issue 1 scope), so running the seed would fail with no
table to insert into. Explained I would add the seed step to the README as
part of Issue 3, once the model and migration existed.

### Issue 2 review
**Reviewer comment I received:** Punyawat noted that `checkSystem()` called
`fetch()` without a try/catch, so if the backend wasn't running at all, it
would throw a raw browser error ("Failed to fetch") instead of a useful
message — not meeting the "useful error message" acceptance criteria.
**How I responded:** Agreed and wrapped the fetch logic in try/catch so both
non-OK responses and network-level failures normalize to the same message,
"Unable to connect to TokTickIT API." Pushed the fix as a new commit on the
same branch and asked for re-review.

### Issue 3 review
**Reviewer comment I received:** Punyawat asked how I could prove the seed
was actually idempotent — concrete evidence (row counts before/after running
twice), or just trusting the `upsert` logic.
**How I responded:** Shared the `psql` output from running the seed twice —
row count stayed at exactly 4 with unchanged `id` and `createdAt` values,
proving the `update: {}` branch ran instead of inserting duplicates. Offered
to add an automated test asserting the count as additional evidence.

## Pull Requests I reviewed for my partner

### Issue 2 (Punyawat's `checkSystem()` implementation)
**My comment:** I noticed `checkSystem()` wraps each individual fetch call
(health, categories) in its own try/catch block rather than using a single
unified error handler. I asked about the rationale — whether it was to
prevent raw "Failed to fetch" messages from surfacing to the user — and
whether edge cases like the backend dropping mid-request had been tested to
confirm the user-facing error message stays clear.

**Partner's response:** Confirmed each fetch is wrapped separately so a
network failure (not just a bad status) still gets normalized to "Unable to
connect to TokTickIT API" instead of the raw browser message. Said they
tested this directly by killing the backend process mid-session and
confirming the UI showed the friendly message, not "Failed to fetch." I
approved and merged after this.

*(Additional review comments/responses for Issues 1, 3, and 4 to be added
here in the same format if further evidence is required.)*