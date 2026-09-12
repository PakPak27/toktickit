import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

let requesterAId: number;
let requesterBId: number;
let ticketAId: number;

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

  requesterAId = requesters[0].id;
  requesterBId = requesters[1].id;

  const createRes = await request(app)
    .post("/api/tickets")
    .set("X-Requester-Id", String(requesterAId))
    .send({
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      summary: "Ticket detail test ticket",
      description: "A sufficiently long description for this test ticket.",
      requestedPriority: "MEDIUM",
    });
  ticketAId = createRes.body.id;
});

describe("GET /api/tickets/:id", () => {
  it("returns the owned ticket with attachments array (happy path)", async () => {
    const res = await request(app)
      .get(`/api/tickets/${ticketAId}`)
      .set("X-Requester-Id", String(requesterAId));

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(ticketAId);
    expect(Array.isArray(res.body.attachments)).toBe(true);
  });

  it("returns 403 when a different Requester requests the ticket (AC-03, BR-11)", async () => {
    const res = await request(app)
      .get(`/api/tickets/${ticketAId}`)
      .set("X-Requester-Id", String(requesterBId));

    expect(res.status).toBe(403);
    expect(res.body).not.toHaveProperty("summary"); // no data leaked
  });

  it("returns 404 for a nonexistent ticket", async () => {
    const res = await request(app)
      .get("/api/tickets/999999999")
      .set("X-Requester-Id", String(requesterAId));

    expect(res.status).toBe(404);
  });
});