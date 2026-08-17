# Lab 1 — AI Use and Reflection

**LLM/agent used:** Claude (Anthropic), used via web chat interface, guided step-by-step through terminal/VS Code

## Selected key prompts (6–10)

| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | Asked for a full step-by-step walkthrough of Issue 1 setup (Git init, GitHub remote, branch structure) since I wasn't sure how to connect a local scaffold to an existing GitHub repo | Followed each command one at a time, hit a non-fast-forward push error, asked for help, and used `git pull --allow-unrelated-histories` to resolve it myself with guidance |
| 2 | Asked how to verify PostgreSQL + Prisma were actually connected, not just "installed" | Ran `npx prisma migrate dev`, initially got a Prisma CLI version mismatch (v7 vs v5.22 in package.json) — had to use `npm run prisma:migrate` (local script) instead of `npx prisma` to force the project's pinned version |
| 3 | Asked for the exact code to replace the `TODO(Issue 2)` stub in `app.ts` for the `/api/health` route | Reviewed the existing test file first to confirm expected response shape, then applied the fix and verified with `npm run test` |
| 4 | After my reviewer (partner) commented that `checkSystem()` didn't handle network-level fetch failures (only non-OK responses), asked how to fix it | Learned the difference between an HTTP error response vs. a thrown network error, wrapped the fetch call in try/catch, and re-tested by fully stopping the backend (not just checking `res.ok`) |
| 5 | Asked for the Category model, migration, and idempotent seed for Issue 3 | Used the `upsert` pattern suggested, then verified manually via `psql` — ran the seed twice and confirmed row count stayed at 4 with unchanged `id`/`createdAt`, which I also used as evidence when my reviewer asked how I could prove idempotency |
| 6 | Asked for the Issue 4 implementation (`/api/categories` route, frontend fetch, and Vitest tests using `vi.spyOn`) | Implemented the route, tested it manually via browser, then had it explain the `vi.spyOn` mocking pattern used in the tests before accepting the test code, since I hadn't used that pattern before |

## Reflection

Clearly state your needs. Type exactly what you want the AI ​​to help you with, such as which issue you're currently working on and the specific requirements. This will prevent the AI ​​from going off-topic.