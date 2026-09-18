import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { getPrisma } from "../../src/prisma.js";
import { loginAsAgent } from "./helpers.js";

let staffAgentA: ReturnType<typeof request.agent>;
let staffAgentB: ReturnType<typeof request.agent>;
let requesterAgent: ReturnType<typeof request.agent>;
let staffAId: number;
let staffBId: number;
let ticketId: number;

beforeAll(async () => {
  const prisma = getPrisma();
  const staffUsers = await prisma.user.findMany({ where: { isActive: true, role: "IT_STAFF" }, orderBy: { id: "asc" }, take: 2 });
  const requester = await prisma.user.findFirst({ where: { isActive: true, role: "REQUESTER" } });
  const category = await prisma.category.findFirst();
  const relatedSystem = await prisma.relatedSystem.findFirst({ where: { isActive: true } });

  if (staffUsers.length < 2 || !requester || !category || !relatedSystem) {
    throw new Error("Seed data missing — run `npm run prisma:seed` before running tests.");
  }

  staffAId = staffUsers[0].id;
  staffBId = staffUsers[1].id;
  staffAgentA = await loginAsAgent(staffUsers[0].email);
  staffAgentB = await loginAsAgent(staffUsers[1].email);
  requesterAgent = await loginAsAgent(requester.email);

  const createRes = await requesterAgent.post("/api/tickets").send({
    categoryId: category.id,
    relatedSystemId: relatedSystem.id,
    summary: "Staff ticket detail test ticket",
    description: "A sufficiently long description for this staff test ticket.",
    requestedPriority: "MEDIUM",
  });
  ticketId = createRes.body.id;
});

describe("GET /api/staff/tickets/:id", () => {
  it("returns the full detail with ticketOwner, requester, and validNextStatuses", async () => {
    const res = await staffAgentA.get(`/api/staff/tickets/${ticketId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(ticketId);
    expect(res.body.ticketOwner).toBeNull();
    expect(res.body.requester).toMatchObject({ id: expect.any(Number), name: expect.any(String) });
    expect(res.body.internalNotes).toEqual([]);
    expect(res.body.validNextStatuses).toEqual(["OPEN", "IN_PROGRESS", "CANCELLED"]);
  });

  it("is forbidden for a Requester (AC-06)", async () => {
    const res = await requesterAgent.get(`/api/staff/tickets/${ticketId}`);
    expect(res.status).toBe(403);
  });

  it("returns 404 for a nonexistent ticket", async () => {
    const res = await staffAgentA.get("/api/staff/tickets/999999999");
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/staff/tickets/:id/owner (AC-07, AC-08)", () => {
  it("claims an unassigned ticket", async () => {
    const res = await staffAgentA.patch(`/api/staff/tickets/${ticketId}/owner`).send({ ticketOwnerId: staffAId });
    expect(res.status).toBe(200);
    expect(res.body.ticketOwner).toEqual({ id: staffAId, name: expect.any(String) });
  });

  it("reassigns to a different active IT Staff member", async () => {
    const res = await staffAgentB.patch(`/api/staff/tickets/${ticketId}/owner`).send({ ticketOwnerId: staffBId });
    expect(res.status).toBe(200);
    expect(res.body.ticketOwner.id).toBe(staffBId);
  });

  it("rejects an inactive/Requester target as owner", async () => {
    const requester = await getPrisma().user.findFirst({ where: { role: "REQUESTER" } });
    const res = await staffAgentA.patch(`/api/staff/tickets/${ticketId}/owner`).send({ ticketOwnerId: requester!.id });
    expect(res.status).toBe(400);
  });

  it("unassigns when ticketOwnerId is null", async () => {
    const res = await staffAgentA.patch(`/api/staff/tickets/${ticketId}/owner`).send({ ticketOwnerId: null });
    expect(res.status).toBe(200);
    expect(res.body.ticketOwner).toBeNull();
  });

  it("is forbidden for a Requester", async () => {
    const res = await requesterAgent.patch(`/api/staff/tickets/${ticketId}/owner`).send({ ticketOwnerId: staffAId });
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/staff/tickets/:id/priority", () => {
  it("sets a valid IT Priority", async () => {
    const res = await staffAgentA.patch(`/api/staff/tickets/${ticketId}/priority`).send({ itPriority: "HIGH" });
    expect(res.status).toBe(200);
    expect(res.body.itPriority).toBe("HIGH");
  });

  it("rejects an invalid priority value", async () => {
    const res = await staffAgentA.patch(`/api/staff/tickets/${ticketId}/priority`).send({ itPriority: "URGENT" });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/staff/tickets/:id/status — transition matrix (AC-09, AC-10, Sec. 5.5)", () => {
  it("rejects NEW -> RESOLVED directly and returns validNextStatuses (AC-09)", async () => {
    const res = await staffAgentA.patch(`/api/staff/tickets/${ticketId}/status`).send({ currentStatus: "RESOLVED" });
    expect(res.status).toBe(400);
    expect(res.body.validNextStatuses).toEqual(["OPEN", "IN_PROGRESS", "CANCELLED"]);
  });

  it("rejects an invalid status value entirely", async () => {
    const res = await staffAgentA.patch(`/api/staff/tickets/${ticketId}/status`).send({ currentStatus: "NOT_A_STATUS" });
    expect(res.status).toBe(400);
  });

  it("walks a full valid sequence, rejects RESOLVED while unassigned (AC-10), then resolves once owned (API-13)", async () => {
    // Fresh ticket for a clean sequence, independent of the owner tests above.
    const category = await getPrisma().category.findFirst();
    const relatedSystem = await getPrisma().relatedSystem.findFirst({ where: { isActive: true } });
    const createRes = await requesterAgent.post("/api/tickets").send({
      categoryId: category!.id,
      relatedSystemId: relatedSystem!.id,
      summary: "Status sequence test ticket",
      description: "A sufficiently long description for this status sequence test.",
      requestedPriority: "LOW",
    });
    const seqTicketId = createRes.body.id;

    const toOpen = await staffAgentA.patch(`/api/staff/tickets/${seqTicketId}/status`).send({ currentStatus: "OPEN" });
    expect(toOpen.status).toBe(200);

    // BR-19: still unassigned — RESOLVED must be rejected even though OPEN -> RESOLVED is matrix-valid.
    const resolveUnassigned = await staffAgentA.patch(`/api/staff/tickets/${seqTicketId}/status`).send({ currentStatus: "RESOLVED" });
    expect(resolveUnassigned.status).toBe(409);

    await staffAgentA.patch(`/api/staff/tickets/${seqTicketId}/owner`).send({ ticketOwnerId: staffAId });

    const toInProgress = await staffAgentA.patch(`/api/staff/tickets/${seqTicketId}/status`).send({ currentStatus: "IN_PROGRESS" });
    expect(toInProgress.status).toBe(200);

    const toResolved = await staffAgentA.patch(`/api/staff/tickets/${seqTicketId}/status`).send({ currentStatus: "RESOLVED" });
    expect(toResolved.status).toBe(200);
    expect(toResolved.body.validNextStatuses).toEqual(["CLOSED", "REOPENED"]);

    const toClosed = await staffAgentA.patch(`/api/staff/tickets/${seqTicketId}/status`).send({ currentStatus: "CLOSED" });
    expect(toClosed.status).toBe(200);

    const toReopened = await staffAgentA.patch(`/api/staff/tickets/${seqTicketId}/status`).send({ currentStatus: "REOPENED" });
    expect(toReopened.status).toBe(200);
  });

  it("clears requesterConfirmedResolved on REOPENED (BR-22)", async () => {
    const category = await getPrisma().category.findFirst();
    const relatedSystem = await getPrisma().relatedSystem.findFirst({ where: { isActive: true } });
    const createRes = await requesterAgent.post("/api/tickets").send({
      categoryId: category!.id,
      relatedSystemId: relatedSystem!.id,
      summary: "Reopen reset test ticket",
      description: "A sufficiently long description for this reopen reset test.",
      requestedPriority: "LOW",
    });
    const reopenTicketId = createRes.body.id;

    await requesterAgent.post(`/api/tickets/${reopenTicketId}/resolved-confirmation`).send();

    // AC-13: IT Staff can see the Requester's confirmation before it's cleared.
    const beforeReopen = await staffAgentA.get(`/api/staff/tickets/${reopenTicketId}`);
    expect(beforeReopen.body.requesterConfirmedResolved).toBe(true);
    expect(beforeReopen.body.requesterConfirmedResolvedAt).toBeTruthy();

    await staffAgentA.patch(`/api/staff/tickets/${reopenTicketId}/owner`).send({ ticketOwnerId: staffAId });
    await staffAgentA.patch(`/api/staff/tickets/${reopenTicketId}/status`).send({ currentStatus: "OPEN" });
    await staffAgentA.patch(`/api/staff/tickets/${reopenTicketId}/status`).send({ currentStatus: "RESOLVED" });
    await staffAgentA.patch(`/api/staff/tickets/${reopenTicketId}/status`).send({ currentStatus: "CLOSED" });
    await staffAgentA.patch(`/api/staff/tickets/${reopenTicketId}/status`).send({ currentStatus: "REOPENED" });

    const detail = await staffAgentA.get(`/api/staff/tickets/${reopenTicketId}`);
    expect(detail.body.requesterConfirmedResolved).toBe(false);
    expect(detail.body.requesterConfirmedResolvedAt).toBeNull();
  });
});

describe("Public Comments visible to IT Staff too (AC-11)", () => {
  it("lets IT Staff read a Public Comment the Requester posted", async () => {
    await requesterAgent.post(`/api/tickets/${ticketId}/comments`).send({ content: "Still happening after restart." });
    const res = await staffAgentA.get(`/api/tickets/${ticketId}/comments`);
    expect(res.status).toBe(200);
    expect(res.body.some((c: { content: string }) => c.content === "Still happening after restart.")).toBe(true);
  });

  it("lets IT Staff post a Public Comment visible to the Requester", async () => {
    const post = await staffAgentA.post(`/api/tickets/${ticketId}/comments`).send({ content: "We are investigating." });
    expect(post.status).toBe(201);
    expect(post.body.authorRole).toBe("IT_STAFF");

    const res = await requesterAgent.get(`/api/tickets/${ticketId}/comments`);
    expect(res.body.some((c: { content: string }) => c.content === "We are investigating.")).toBe(true);
  });
});

describe("Internal Notes (AC-06, AC-12)", () => {
  it("lets IT Staff post and read a note", async () => {
    const post = await staffAgentA.post(`/api/staff/tickets/${ticketId}/notes`).send({ content: "Escalated to vendor." });
    expect(post.status).toBe(201);
    expect(post.body.authorRole).toBe("IT_STAFF");

    const list = await staffAgentA.get(`/api/staff/tickets/${ticketId}/notes`);
    expect(list.status).toBe(200);
    expect(list.body.some((n: { content: string }) => n.content === "Escalated to vendor.")).toBe(true);
  });

  it("rejects whitespace-only content (BR-26)", async () => {
    const res = await staffAgentA.post(`/api/staff/tickets/${ticketId}/notes`).send({ content: "   " });
    expect(res.status).toBe(400);
  });

  it("is forbidden for a Requester, without exposing note content (AC-06)", async () => {
    const post = await requesterAgent.post(`/api/staff/tickets/${ticketId}/notes`).send({ content: "trying to sneak a note in" });
    expect(post.status).toBe(403);
    expect(post.body).not.toHaveProperty("content");

    const list = await requesterAgent.get(`/api/staff/tickets/${ticketId}/notes`);
    expect(list.status).toBe(403);
  });

  it("never appears on the Requester-facing GET /api/tickets/:id (AC-12)", async () => {
    const res = await requesterAgent.get(`/api/tickets/${ticketId}`);
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty("internalNotes");
    expect(JSON.stringify(res.body)).not.toContain("Escalated to vendor.");
  });
});
