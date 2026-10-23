import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { getPrisma } from "../../src/prisma.js";
import { loginAsAgent } from "../lab-03/helpers.js";

let staffAgentA: ReturnType<typeof request.agent>;
let staffAgentB: ReturnType<typeof request.agent>;
let requesterAgent: ReturnType<typeof request.agent>;
let otherRequesterAgent: ReturnType<typeof request.agent>;
let ticketId: number;

beforeAll(async () => {
  const prisma = getPrisma();
  const staffUsers = await prisma.user.findMany({
    where: { isActive: true, role: "IT_STAFF" },
    orderBy: { id: "asc" },
    take: 2,
  });
  const requesters = await prisma.user.findMany({
    where: { isActive: true, role: "REQUESTER" },
    orderBy: { id: "asc" },
    take: 2,
  });
  const category = await prisma.category.findFirst();
  const relatedSystem = await prisma.relatedSystem.findFirst({ where: { isActive: true } });

  if (staffUsers.length < 2 || requesters.length < 2 || !category || !relatedSystem) {
    throw new Error("Seed data missing — run `npm run prisma:seed` before running tests.");
  }

  staffAgentA = await loginAsAgent(staffUsers[0].email);
  staffAgentB = await loginAsAgent(staffUsers[1].email);
  requesterAgent = await loginAsAgent(requesters[0].email);
  otherRequesterAgent = await loginAsAgent(requesters[1].email);

  const createRes = await requesterAgent.post("/api/tickets").send({
    categoryId: category.id,
    relatedSystemId: relatedSystem.id,
    summary: "Actions Taken test ticket",
    description: "A sufficiently long description for this Actions Taken test ticket.",
    requestedPriority: "MEDIUM",
  });
  ticketId = createRes.body.id;
});

describe("POST /api/staff/tickets/:id/actions (AC-01, AC-03)", () => {
  it("creates an Action Taken with the authenticated performer (AC-01)", async () => {
    const res = await staffAgentA.post(`/api/staff/tickets/${ticketId}/actions`).send({
      description: "Checked the Requester's account lockout status.",
      result: "Account was not locked; issue is elsewhere.",
      followUpRequired: false,
    });
    expect(res.status).toBe(201);
    expect(res.body.ticketId).toBe(ticketId);
    expect(res.body.performedByName).toEqual(expect.any(String));
    expect(res.body.followUpNote).toBeNull();
  });

  it("rejects an empty description or result (BR-05)", async () => {
    const res = await staffAgentA.post(`/api/staff/tickets/${ticketId}/actions`).send({
      description: "",
      result: "Something",
      followUpRequired: false,
    });
    expect(res.status).toBe(400);
  });

  it("requires a follow-up note when follow-up is required (AC-03, BR-06)", async () => {
    const res = await staffAgentA.post(`/api/staff/tickets/${ticketId}/actions`).send({
      description: "Escalated to the network team.",
      result: "Awaiting their response.",
      followUpRequired: true,
      // followUpNote intentionally omitted
    });
    expect(res.status).toBe(400);
  });

  it("is forbidden for a Requester (AC-08, BR-08)", async () => {
    const res = await requesterAgent.post(`/api/staff/tickets/${ticketId}/actions`).send({
      description: "Should never be created.",
      result: "Should never be created.",
      followUpRequired: false,
    });
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/staff/tickets/:id/actions/:actionId (AC-02, AC-07)", () => {
  it("lets a different IT Staff member edit it, keeping the original performer (AC-02, BR-02/BR-03)", async () => {
    const created = await staffAgentA.post(`/api/staff/tickets/${ticketId}/actions`).send({
      description: "Initial diagnosis by staff member A.",
      result: "Needs further investigation.",
      followUpRequired: true,
      followUpNote: "Check again tomorrow.",
    });
    const actionId = created.body.id;
    const originalPerformedById = created.body.performedById;

    const res = await staffAgentB
      .patch(`/api/staff/tickets/${ticketId}/actions/${actionId}`)
      .send({ result: "Follow-up complete, issue resolved.", followUpRequired: false, updatedAt: created.body.updatedAt });

    expect(res.status).toBe(200);
    expect(res.body.performedById).toBe(originalPerformedById);
    expect(res.body.result).toBe("Follow-up complete, issue resolved.");
    expect(res.body.followUpRequired).toBe(false);
    expect(res.body.followUpNote).toBeNull();
    expect(res.body.updatedAt).not.toBe(created.body.updatedAt);
  });

  it("rejects a stale updatedAt instead of overwriting a newer edit (AC-07, BR-13)", async () => {
    const created = await staffAgentA.post(`/api/staff/tickets/${ticketId}/actions`).send({
      description: "Concurrency test action.",
      result: "Initial result.",
      followUpRequired: false,
    });
    const actionId = created.body.id;

    // First edit succeeds and moves updatedAt forward.
    const firstEdit = await staffAgentA
      .patch(`/api/staff/tickets/${ticketId}/actions/${actionId}`)
      .send({ result: "Updated by the first edit.", updatedAt: created.body.updatedAt });
    expect(firstEdit.status).toBe(200);

    // Second edit still carries the original (now stale) updatedAt.
    const staleEdit = await staffAgentB
      .patch(`/api/staff/tickets/${ticketId}/actions/${actionId}`)
      .send({ result: "Should be rejected.", updatedAt: created.body.updatedAt });
    expect(staleEdit.status).toBe(409);
    expect(staleEdit.body.current.result).toBe("Updated by the first edit.");

    const stillCurrent = await getPrisma().actionTaken.findUnique({ where: { id: actionId } });
    expect(stillCurrent?.result).toBe("Updated by the first edit.");
  });
});

describe("GET /api/tickets/:id/actions and /api/staff/tickets/:id/actions (AC-08)", () => {
  it("lets the owning Requester read Actions Taken, read-only", async () => {
    const res = await requesterAgent.get(`/api/tickets/${ticketId}/actions`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it("is forbidden for a non-owning Requester (BR-08)", async () => {
    const res = await otherRequesterAgent.get(`/api/tickets/${ticketId}/actions`);
    expect(res.status).toBe(403);
  });

  it("lists Actions Taken newest first for IT Staff", async () => {
    const res = await staffAgentA.get(`/api/staff/tickets/${ticketId}/actions`);
    expect(res.status).toBe(200);
    const timestamps = res.body.map((a: { createdAt: string }) => new Date(a.createdAt).getTime());
    expect([...timestamps].sort((a, b) => b - a)).toEqual(timestamps);
  });
});
