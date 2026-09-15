import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

export const SEED_PASSWORD = "ChangeMe123!";

// Returns a supertest agent already logged in as the given seeded user, so
// every later request on that agent carries the session cookie — the
// authenticated-session equivalent of Lab 2's `X-Requester-Id` header.
//
// Seeded accounts always start with mustChangePassword: true by design
// (BR-06/BR-37, demoed by auth.api.test.ts) — that gate is not what these
// ticket/attachment ownership tests exercise, so it's cleared directly via
// Prisma rather than mutating the shared seed password through the
// change-password flow, keeping SEED_PASSWORD valid across repeated runs.
export async function loginAsAgent(email: string, password = SEED_PASSWORD) {
  await getPrisma().user.updateMany({ where: { email }, data: { mustChangePassword: false } });
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/login").send({ email, password });
  if (res.status !== 200) {
    throw new Error(`Login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return agent;
}
