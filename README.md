# TokTickIT

TokTickIT (ตอกติ๊กกิต) — IT Service Desk application.
CPE334 Lab 1: Full-stack vertical slice (React → Express → Prisma → PostgreSQL).

## Tech Stack

- Frontend: React + TypeScript + Vite + Bootstrap
- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL + Prisma ORM
- Testing: Vitest (frontend + backend unit) + Supertest (API)

## Prerequisites

- Node.js (v18+)
- PostgreSQL running locally (or via Docker)

## Setup

### 1. Clone the repository

\`\`\`bash
git clone https://github.com/<your-username>/toktickit.git
cd toktickit
\`\`\`

### 2. Backend setup

\`\`\`bash
cd server
npm install
cp .env.example .env
# Edit .env and set DATABASE_URL to match your local PostgreSQL user/password/db
npm run prisma:migrate
\`\`\`

### 3. Frontend setup

\`\`\`bash
cd client
npm install
\`\`\`

## Running the app

**Backend** (from \`server/\`):

\`\`\`bash
npm run dev
\`\`\`

Runs on http://localhost:3000

**Frontend** (from \`client/\`, in a separate terminal):

\`\`\`bash
npm run dev
\`\`\`

Runs on http://localhost:5173

## Running tests

**Backend** (from \`server/\`):

\`\`\`bash
npm run test
\`\`\`

**Frontend** (from \`client/\`):

\`\`\`bash
npm run test
\`\`\`

## Project Structure

\`\`\`
toktickit/
├── client/          # React + Vite frontend
├── server/          # Express + Prisma backend
│   ├── prisma/      # Prisma schema, migrations, seed
│   ├── src/         # Express app source
│   └── tests/lab-01 # Supertest API tests
├── docs/lab-01/     # ai_use.md, reviewer.md, tests.md
├── .gitignore
└── README.md
\`\`\`