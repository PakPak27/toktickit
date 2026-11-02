# TokTickIT

TokTickIT (ตอกติ๊กกิต) — IT Service Desk application.
CPE334 Lab 1-4: Full-stack ticketing app with authentication, role-based
access, a recorded work log per Ticket, and role dashboards
(React → Express → Prisma → PostgreSQL).

## Tech Stack

- Frontend: React + TypeScript + Vite + Bootstrap, React Router
- Backend: Node.js + Express + TypeScript, Multer (file uploads)
- Database: PostgreSQL + Prisma ORM
- Testing: Vitest (unit/UI) + Supertest (API) + Playwright (E2E/visual)

## Prerequisites

- Node.js (v18+)
- PostgreSQL running locally (or via Docker)

## Setup

### 1. Clone the repository

\`\`\`bash
git clone https://github.com/PakPak27/toktickit.git
cd toktickit
\`\`\`

### 2. Backend setup

\`\`\`bash
cd server
npm install
cp .env.example .env
# Edit .env: set DATABASE_URL to match your local PostgreSQL user/password/db,
# and set JWT_SECRET to your own random local value (see the comment in
# .env.example for a one-line command to generate one).
npm run prisma:migrate
npm run prisma:seed
\`\`\`

**Seed credentials (local development only, never real secrets):** every
seeded account (Requester, IT Staff, and Administrator) uses the password
\`ChangeMe123!\` and must change it at first login. The Lab 4 seed also adds
Actions Taken (zero, one, and several per Ticket, including at least one
open follow-up) across a spread of Ticket statuses. See
\`server/prisma/seed.ts\` for the full list of seeded accounts and roles.

### 3. Frontend setup

\`\`\`bash
cd client
npm install
\`\`\`

### 4. E2E test setup (Lab 2, optional)

\`\`\`bash
npm install
npx playwright install chromium
\`\`\`

## Running the app

**Backend** (from \`server/\`): \`npm run dev\` — runs on http://localhost:3000
**Frontend** (from \`client/\`, separate terminal): \`npm run dev\` — runs on http://localhost:5173

## Running tests

**Backend** (from \`server/\`): \`npm run test\`
**Frontend** (from \`client/\`): \`npm run test\`
**E2E / visual** (from repo root, with both servers running):
\`\`\`bash
npx playwright test e2e/lab-04
npx playwright test e2e/lab-03 --grep-invert "report-evidence"   # regression
\`\`\`
(\`e2e/lab-02\` was removed in Lab 3 — it depended on the Development
Requester selector, which no longer exists; its coverage is superseded by
\`e2e/lab-03/requester-regression.spec.ts\`. \`e2e/lab-03/report-evidence.spec.ts\`
is a one-shot evidence-capture spec for the Lab 3 submission report, not
part of the regression suite — run it on its own, since one of its tests
deliberately leaves a fixture account's password mid-reset.)

## Features

**Lab 1:** Backend health check, IT request category list (vertical slice).

**Lab 2:** Development Requester selector (testing-only identity), Create Ticket
with validation and attachments, My Tickets (search/filter/sort/pagination),
Requester Ticket Detail with attachment upload/download/soft-removal, responsive
Zen Green UI, full E2E/visual test coverage.

**Lab 3:** email/password authentication with mandatory first-login
password change; role-based authorization (Requester / IT Staff /
Administrator) enforced server-side. The Lab 2 Development Requester
selector has been fully removed — all Requester ticket/attachment functions
now run on the authenticated session, with Public Comments and a
"Problem Appears Resolved" action added to Ticket Detail. IT Staff/
Administrator have a Ticket Queue (search/filter/sort/pagination across
all Requesters, owner filter) and a full Ticket Detail screen: claim/
reassign ownership, IT Priority, the complete status workflow (NEW →
OPEN/IN_PROGRESS → WAITING_FOR_REQUESTER/RESOLVED → CLOSED/REOPENED/
CANCELLED per the transition matrix), and Internal Notes kept separate
from Public Comments. Administrators have a minimalist User Management
screen: list/search/role-filter, create/edit accounts, activate/
deactivate, and reset a user's password — with duplicate-email,
self-deactivation, and last-active-Administrator safety rules enforced
server-side. Full responsive/visual QA and E2E coverage complete (21/21
passing); see `docs/lab-03/tests.md` for the final test report.

**Lab 4:** Actions Taken — a dated work log per Ticket (description, result,
performer from the session, optional follow-up) that any IT Staff/
Administrator can add or edit, shown read-only to the owning Requester. A
Ticket can only move to Resolved once the backend confirms at least one
Action Taken exists and none has an open follow-up (enforced server-side
regardless of what the UI shows); Action Taken edits and Ticket status
changes both reject a stale `updatedAt` instead of silently overwriting a
newer change. Every role now lands on a Dashboard first — Requester (own
Ticket counts, a "Needs Your Attention" list, recent Tickets) or IT Staff/
Administrator (queue-wide counts, recent Tickets) — with every metric card
linking into My Tickets/the Ticket Queue pre-filtered to match. Full
responsive/visual QA and E2E coverage complete; see `docs/lab-04/tests.md`
for the final test report.

## Project Structure

\`\`\`
toktickit/
├── client/              # React + Vite frontend
│   └── tests/lab-01/, lab-02/, lab-03/, lab-04/   # Vitest + Testing Library
├── server/              # Express + Prisma backend
│   ├── prisma/          # Prisma schema, migrations, seed
│   ├── src/              # Express app source
│   └── tests/lab-01/, lab-02/, lab-03/, lab-04/   # Supertest API tests
├── e2e/lab-03/, lab-04/  # Playwright E2E and visual tests (supersedes e2e/lab-02)
├── artifacts/lab-03/, lab-04/screenshots/  # Responsive screenshots (desktop/tablet/mobile)
├── docs/lab-01/, lab-02/, lab-03/, lab-04/  # specification.md, tests.md,
│                          # ui-spec.md, api-spec.md, ai-use.md, reviewer.md
├── .gitignore
└── README.md
\`\`\`