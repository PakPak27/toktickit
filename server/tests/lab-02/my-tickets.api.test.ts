import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

let requesterAId: number;
let requesterBId: number;
let categoryId: number;
let relatedSystemId: number;

// Unique per test run so repeated `npm run test` invocations never collide
// with tickets left over from previous runs (no test-database reset in Lab 2).
const RUN_ID = Date.now();
const MARKER_A = `unique-marker-alpha-${RUN_ID}`;
const MARKER_B = `unique-marker-beta-${RUN_ID}`;

async function createTicketFor(requesterId: number, summary: string) {
  return request(app)
    .post("/api/tickets")
    .set("X-Requester-Id", String(requesterId))
    .send({
      categoryId,
      relatedSystemId,
      summary,
      description: "A sufficiently long description for this test ticket.",
      requestedPriority: "MEDIUM",
    });
}

beforeAll(async () => {
  const prisma = getPrisma();
  const requesters = await prisma.requesterUser.findMany({
    where: { isActive: true },
    orderBy: { id: "asc" },
    take: 2,
  });
  const category = await prisma.category.findFirst();
  const relatedSystem = await prisma.relatedSystem.findFirst({ where: { isActive: true } });

  if (requesters.length < 2 || !category || !relatedSystem) {
    throw new Error("Seed data missing — run `npm run prisma:seed` before running tests.");
  }

  requesterAId = requesters[0].id;
  requesterBId = requesters[1].id;
  categoryId = category.id;
  relatedSystemId = relatedSystem.id;

  // Requester A gets 3 tickets, Requester B gets 2 — used for ownership scoping (AC-11)
  await createTicketFor(requesterAId, `A-ticket-one ${MARKER_A}`);
  await createTicketFor(requesterAId, `A-ticket-two ${MARKER_A}`);
  await createTicketFor(requesterAId, `A-ticket-three ${MARKER_A}`);
  await createTicketFor(requesterBId, `B-ticket-one ${MARKER_B}`);
  await createTicketFor(requesterBId, `B-ticket-two ${MARKER_B}`);
});

describe("GET /api/tickets", () => {
  it("returns only the current Requester's own tickets (AC-11, BR-09/10)", async () => {
    const resA = await request(app)
      .get("/api/tickets")
      .query({ search: MARKER_A, pageSize: 50 })
      .set("X-Requester-Id", String(requesterAId));
    expect(resA.status).toBe(200);
    expect(resA.body.data.length).toBe(3);
    expect(resA.body.data.every((t: { summary: string }) => t.summary.includes(MARKER_A))).toBe(true);

    // Requester B must never see Requester A's tickets, even ones matching the search term
    const resBSearchingForA = await request(app)
      .get("/api/tickets")
      .query({ search: MARKER_A, pageSize: 50 })
      .set("X-Requester-Id", String(requesterBId));
    expect(resBSearchingForA.status).toBe(200);
    expect(resBSearchingForA.body.data.length).toBe(0);

    const resB = await request(app)
      .get("/api/tickets")
      .query({ search: MARKER_B, pageSize: 50 })
      .set("X-Requester-Id", String(requesterBId));
    expect(resB.status).toBe(200);
    expect(resB.body.data.length).toBe(2);
    expect(resB.body.data.every((t: { summary: string }) => t.summary.includes(MARKER_B))).toBe(true);
  });

  it("paginates results correctly (AC-13)", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .query({ pageSize: 10, page: 1 })
      .set("X-Requester-Id", String(requesterAId));

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(10);
    expect(res.body.pagination).toMatchObject({ page: 1, pageSize: 10 });
    expect(res.body.pagination.totalItems).toBeGreaterThanOrEqual(3);
  });

  it("sorts by createdAt ascending when requested (AC-14)", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .query({ sort: "createdAt", order: "asc" })
      .set("X-Requester-Id", String(requesterAId));

    expect(res.status).toBe(200);
    const dates = res.body.data.map((t: { createdAt: string }) => new Date(t.createdAt).getTime());
    const sorted = [...dates].sort((a, b) => a - b);
    expect(dates).toEqual(sorted);
  });

  it("returns an empty array for a search with no matches (AC-12)", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .query({ search: "zzzz-no-such-ticket-zzzz" })
      .set("X-Requester-Id", String(requesterAId));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.totalItems).toBe(0);
  });

  it("falls back to defaults for invalid sort/order/pageSize params (BR-14)", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .query({ sort: "invalidField", order: "sideways", pageSize: 999 })
      .set("X-Requester-Id", String(requesterAId));

    expect(res.status).toBe(200);
    expect(res.body.pagination.pageSize).toBe(10);
  });
});