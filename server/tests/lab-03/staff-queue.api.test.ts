import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { loginAsAgent } from "./helpers.js";

let staffAgent: ReturnType<typeof request.agent>;
let requesterAgent: ReturnType<typeof request.agent>;
let categoryId: number;
let relatedSystemId: number;

// Unique per test run so repeated `npm run test` invocations never collide
// with tickets left over from previous runs.
const RUN_ID = Date.now();
const MARKER = `queue-marker-${RUN_ID}`;

beforeAll(async () => {
  const prisma = getPrisma();
  const staff = await prisma.user.findFirst({ where: { isActive: true, role: "IT_STAFF" } });
  const requester = await prisma.user.findFirst({ where: { isActive: true, role: "REQUESTER" } });
  const category = await prisma.category.findFirst();
  const relatedSystem = await prisma.relatedSystem.findFirst({ where: { isActive: true } });

  if (!staff || !requester || !category || !relatedSystem) {
    throw new Error("Seed data missing — run `npm run prisma:seed` before running tests.");
  }

  categoryId = category.id;
  relatedSystemId = relatedSystem.id;
  staffAgent = await loginAsAgent(staff.email);
  requesterAgent = await loginAsAgent(requester.email);

  // 3 tickets from the Requester side, visible to the queue regardless of owner.
  for (let i = 0; i < 3; i++) {
    await requesterAgent.post("/api/tickets").send({
      categoryId,
      relatedSystemId,
      summary: `${MARKER}-${i}`,
      description: "A sufficiently long description for this queue test ticket.",
      requestedPriority: "MEDIUM",
    });
  }
});

describe("GET /api/staff/tickets (AC-14, AC-18)", () => {
  it("is forbidden for a Requester", async () => {
    const res = await requesterAgent.get("/api/staff/tickets");
    expect(res.status).toBe(403);
  });

  it("rejects an unauthenticated request", async () => {
    const res = await request(app).get("/api/staff/tickets");
    expect(res.status).toBe(401);
  });

  it("returns tickets across all Requesters, not scoped to the caller", async () => {
    const res = await staffAgent.get("/api/staff/tickets").query({ search: MARKER, pageSize: 50 });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(3);
    expect(res.body.data.every((t: { summary: string }) => t.summary.includes(MARKER))).toBe(true);
  });

  it("shows ticketOwner: null for unassigned tickets", async () => {
    const res = await staffAgent.get("/api/staff/tickets").query({ search: MARKER, pageSize: 50 });
    expect(res.status).toBe(200);
    expect(res.body.data.every((t: { ticketOwner: unknown }) => t.ticketOwner === null)).toBe(true);
  });

  it("filters by owner=unassigned and owner=mine", async () => {
    const unassigned = await staffAgent
      .get("/api/staff/tickets")
      .query({ search: MARKER, owner: "unassigned", pageSize: 50 });
    expect(unassigned.status).toBe(200);
    expect(unassigned.body.data.length).toBe(3);

    const mine = await staffAgent.get("/api/staff/tickets").query({ search: MARKER, owner: "mine", pageSize: 50 });
    expect(mine.status).toBe(200);
    expect(mine.body.data.length).toBe(0); // none claimed yet — claiming lands in Issue #33
  });

  // Regression test for the PR #38 review finding: an invalid categoryId
  // or itPriority must fall back silently (BR-14), never 500 at Prisma.
  it("ignores a non-numeric categoryId and an out-of-enum itPriority instead of erroring", async () => {
    const res = await staffAgent
      .get("/api/staff/tickets")
      .query({ search: MARKER, categoryId: "abc", itPriority: "URGENT", pageSize: 50 });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(3);
  });

  it("paginates and falls back to defaults for invalid params (BR-14)", async () => {
    const res = await staffAgent
      .get("/api/staff/tickets")
      .query({ search: MARKER, sort: "nope", order: "sideways", pageSize: 999, page: 1 });
    expect(res.status).toBe(200);
    expect(res.body.pagination.pageSize).toBe(10);
  });
});
