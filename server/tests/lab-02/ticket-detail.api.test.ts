import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { getPrisma } from "../../src/prisma.js";
import { loginAsAgent } from "../lab-03/helpers.js";

let agentA: ReturnType<typeof request.agent>;
let agentB: ReturnType<typeof request.agent>;
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

  agentA = await loginAsAgent(requesters[0].email);
  agentB = await loginAsAgent(requesters[1].email);

  const createRes = await agentA.post("/api/tickets").send({
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
    const res = await agentA.get(`/api/tickets/${ticketAId}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(ticketAId);
    expect(Array.isArray(res.body.attachments)).toBe(true);
    expect(res.body.requesterConfirmedResolved).toBe(false);
  });

  it("returns 403 when a different Requester requests the ticket (AC-05, BR-10)", async () => {
    const res = await agentB.get(`/api/tickets/${ticketAId}`);

    expect(res.status).toBe(403);
    expect(res.body).not.toHaveProperty("summary"); // no data leaked
  });

  it("returns 404 for a nonexistent ticket", async () => {
    const res = await agentA.get("/api/tickets/999999999");

    expect(res.status).toBe(404);
  });
});

describe("Public Comments (AC-11)", () => {
  it("lets the owning Requester post a comment, visible on a later read", async () => {
    const post = await agentA.post(`/api/tickets/${ticketAId}/comments`).send({ content: "Any update on this?" });
    expect(post.status).toBe(201);
    expect(post.body.content).toBe("Any update on this?");
    expect(post.body.authorRole).toBe("REQUESTER");

    const get = await agentA.get(`/api/tickets/${ticketAId}/comments`);
    expect(get.status).toBe(200);
    expect(get.body.some((c: { content: string }) => c.content === "Any update on this?")).toBe(true);
  });

  it("rejects whitespace-only content (BR-26)", async () => {
    const res = await agentA.post(`/api/tickets/${ticketAId}/comments`).send({ content: "   " });
    expect(res.status).toBe(400);
  });

  it("rejects a comment from a Requester who does not own the ticket (BR-10)", async () => {
    const res = await agentB.post(`/api/tickets/${ticketAId}/comments`).send({ content: "Not my ticket" });
    expect(res.status).toBe(403);
  });
});

describe("POST /api/tickets/:id/resolved-confirmation (AC-13)", () => {
  it("sets requesterConfirmedResolved without changing currentStatus", async () => {
    const res = await agentA.post(`/api/tickets/${ticketAId}/resolved-confirmation`).send();
    expect(res.status).toBe(200);
    expect(res.body.requesterConfirmedResolved).toBe(true);
    expect(res.body.requesterConfirmedResolvedAt).toBeTruthy();

    const detail = await agentA.get(`/api/tickets/${ticketAId}`);
    expect(detail.body.currentStatus).toBe("NEW");
    expect(detail.body.requesterConfirmedResolved).toBe(true);
  });

  it("rejects it for a ticket the Requester does not own", async () => {
    const res = await agentB.post(`/api/tickets/${ticketAId}/resolved-confirmation`).send();
    expect(res.status).toBe(403);
  });
});
