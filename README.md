# TokTickIT

TokTickIT (ตอกติ๊กกิต) — IT Service Desk application.
CPE334 Lab 1-3: Full-stack ticketing app with authentication and role-based
access (React → Express → Prisma → PostgreSQL).

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

**Lab 3 seed credentials (local development only, never real secrets):**
every seeded account (Requester, IT Staff, and Administrator) uses the
password \`ChangeMe123!\` and must change it at first login. See
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
**E2E / visual** (from repo root, with both servers running): \`npx playwright test e2e/lab-02\`

## Features

**Lab 1:** Backend health check, IT request category list (vertical slice).

**Lab 2:** Development Requester selector (testing-only identity), Create Ticket
with validation and attachments, My Tickets (search/filter/sort/pagination),
Requester Ticket Detail with attachment upload/download/soft-removal, responsive
Zen Green UI, full E2E/visual test coverage.

**Lab 3 (in progress):** email/password authentication with mandatory
first-login password change, replacing the Lab 2 Development Requester
selector; role-based authorization (Requester / IT Staff / Administrator)
enforced server-side. Remaining Lab 3 work (IT Staff Ticket Queue and
operations, Public Comments/Internal Notes, Administrator user management)
tracked in the `TokTickIT-Lab3` GitHub Project.

## Project Structure

\`\`\`
toktickit/
├── client/              # React + Vite frontend
├── server/              # Express + Prisma backend
│   ├── prisma/          # Prisma schema, migrations, seed
│   ├── src/              # Express app source
│   └── tests/lab-01/, lab-02/, lab-03/   # Supertest API tests
├── e2e/lab-02/           # Playwright E2E and visual tests
├── artifacts/lab-02/screenshots/  # Responsive screenshots (desktop/tablet/mobile)
├── docs/lab-01/, lab-02/, lab-03/  # specification.md, tests.md, ui-spec.md,
│                          # api-spec.md, ai-use.md, reviewer.md
├── .gitignore
└── README.md
\`\`\`