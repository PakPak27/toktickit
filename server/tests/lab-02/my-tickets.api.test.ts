import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { getPrisma } from "../../src/prisma.js";
import { loginAsAgent } from "../lab-03/helpers.js";

let agentA: ReturnType<typeof request.agent>;
let agentB: ReturnType<typeof request.agent>;
let categoryId: number;
let relatedSystemId: number;

// Unique per test run so repeated `npm run test` invocations never collide
// with tickets left over from previous runs (no test-database reset in Lab 2).
const RUN_ID = Date.now();
const MARKER_A = `unique-marker-alpha-${RUN_ID}`;
const MARKER_B = `unique-marker-beta-${RUN_ID}`;

async function createTicketAs(agent: ReturnType<typeof request.agent>, summary: string) {
  return agent.post("/api/tickets").send({
    categoryId,
    relatedSystemId,
    summary,
    description: "A sufficiently long description for this test ticket.",
    requestedPriority: "MEDIUM",
  });
}

beforeAll(async () => {
  const prisma = getPrisma();
  const requesters = await prisma.user.findMany({
    where: { isActive: true, role: "REQUESTER" },
    orderBy: { id: "asc" },
    take: 2,
  });
  const category = await prisma.category.findFirst();
  const relatedSystem = await prisma.relatedSystem.findFirst({ where: { isActive: true } });

  if (requesters.length < 2 || !category || !relatedSystem) {
    throw new Error("Seed data missing — run `npm run prisma:seed` before running tests.");
  }

  categoryId = category.id;
  relatedSystemId = relatedSystem.id;
  agentA = await loginAsAgent(requesters[0].email);
  agentB = await loginAsAgent(requesters[1].email);

  // Requester A gets 3 tickets, Requester B gets 2 — used for ownership scoping (AC-11)
  await createTicketAs(agentA, `A-ticket-one ${MARKER_A}`);
  await createTicketAs(agentA, `A-ticket-two ${MARKER_A}`);
  await createTicketAs(agentA, `A-ticket-three ${MARKER_A}`);
  await createTicketAs(agentB, `B-ticket-one ${MARKER_B}`);
  await createTicketAs(agentB, `B-ticket-two ${MARKER_B}`);
});

describe("GET /api/tickets", () => {
  it("returns only the current Requester's own tickets (AC-11, BR-09/10)", async () => {
    const resA = await agentA.get("/api/tickets").query({ search: MARKER_A, pageSize: 50 });
    expect(resA.status).toBe(200);
    expect(resA.body.data.length).toBe(3);
    expect(resA.body.data.every((t: { summary: string }) => t.summary.includes(MARKER_A))).toBe(true);

    // Requester B must never see Requester A's tickets, even ones matching the search term
    const resBSearchingForA = await agentB.get("/api/tickets").query({ search: MARKER_A, pageSize: 50 });
    expect(resBSearchingForA.status).toBe(200);
    expect(resBSearchingForA.body.data.length).toBe(0);

    const resB = await agentB.get("/api/tickets").query({ search: MARKER_B, pageSize: 50 });
    expect(resB.status).toBe(200);
    expect(resB.body.data.length).toBe(2);
    expect(resB.body.data.every((t: { summary: string }) => t.summary.includes(MARKER_B))).toBe(true);
  });

  it("paginates results correctly (AC-13)", async () => {
    const res = await agentA.get("/api/tickets").query({ pageSize: 10, page: 1 });

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(10);
    expect(res.body.pagination).toMatchObject({ page: 1, pageSize: 10 });
    expect(res.body.pagination.totalItems).toBeGreaterThanOrEqual(3);
  });

  it("sorts by createdAt ascending when requested (AC-14)", async () => {
    const res = await agentA.get("/api/tickets").query({ sort: "createdAt", order: "asc" });

    expect(res.status).toBe(200);
    const dates = res.body.data.map((t: { createdAt: string }) => new Date(t.createdAt).getTime());
    const sorted = [...dates].sort((a, b) => a - b);
    expect(dates).toEqual(sorted);
  });

  it("returns an empty array for a search with no matches (AC-12)", async () => {
    const res = await agentA.get("/api/tickets").query({ search: "zzzz-no-such-ticket-zzzz" });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.totalItems).toBe(0);
  });

  it("falls back to defaults for invalid sort/order/pageSize params (BR-14)", async () => {
    const res = await agentA.get("/api/tickets").query({ sort: "invalidField", order: "sideways", pageSize: 999 });

    expect(res.status).toBe(200);
    expect(res.body.pagination.pageSize).toBe(10);
  });
});
