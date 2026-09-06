# TokTickIT

TokTickIT (ตอกติ๊กกิต) — IT Service Desk application.
CPE334 Lab 1-2: Full-stack ticketing MVP (React → Express → Prisma → PostgreSQL).

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
# Edit .env and set DATABASE_URL to match your local PostgreSQL user/password/db
npm run prisma:migrate
npm run prisma:seed
\`\`\`

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

## Project Structure

\`\`\`
toktickit/
├── client/              # React + Vite frontend
├── server/              # Express + Prisma backend
│   ├── prisma/          # Prisma schema, migrations, seed
│   ├── src/              # Express app source
│   └── tests/lab-01/, lab-02/   # Supertest API tests
├── e2e/lab-02/           # Playwright E2E and visual tests
├── artifacts/lab-02/screenshots/  # Responsive screenshots (desktop/tablet/mobile)
├── docs/lab-01/, lab-02/  # specification.md, tests.md, ui-spec.md, api-spec.md,
│                          # ai-use.md, reviewer.md
├── .gitignore
└── README.md
\`\`\`