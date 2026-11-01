import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { getPrisma } from "../../src/prisma.js";
import { loginAsAgent } from "../lab-03/helpers.js";

let staffAgent: ReturnType<typeof request.agent>;
let requesterAgent: ReturnType<typeof request.agent>;
let staffId: number;
let categoryId: number;
let relatedSystemId: number;

beforeAll(async () => {
  const prisma = getPrisma();
  const staff = await prisma.user.findFirst({ where: { isActive: true, role: "IT_STAFF" } });
  const requester = await prisma.user.findFirst({ where: { isActive: true, role: "REQUESTER" } });
  const category = await prisma.category.findFirst();
  const relatedSystem = await prisma.relatedSystem.findFirst({ where: { isActive: true } });

  if (!staff || !requester || !category || !relatedSystem) {
    throw new Error("Seed data missing — run `npm run prisma:seed` before running tests.");
  }

  staffId = staff.id;
  categoryId = category.id;
  relatedSystemId = relatedSystem.id;
  staffAgent = await loginAsAgent(staff.email);
  requesterAgent = await loginAsAgent(requester.email);
});

async function newOwnedTicket(summary: string) {
  const createRes = await requesterAgent.post("/api/tickets").send({
    categoryId,
    relatedSystemId,
    summary,
    description: `A sufficiently long description for "${summary}".`,
    requestedPriority: "LOW",
  });
  const ticketId = createRes.body.id;
  await staffAgent.patch(`/api/staff/tickets/${ticketId}/owner`).send({ ticketOwnerId: staffId });
  const ticket = await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticketId } });
  await staffAgent
    .patch(`/api/staff/tickets/${ticketId}/status`)
    .send({ currentStatus: "IN_PROGRESS", updatedAt: ticket.updatedAt.toISOString() });
  const inProgress = await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticketId } });
  return { ticketId, updatedAt: inProgress.updatedAt.toISOString() };
}

async function patchStatus(ticketId: number, currentStatus: string, updatedAt: string) {
  return staffAgent.patch(`/api/staff/tickets/${ticketId}/status`).send({ currentStatus, updatedAt });
}

describe("Resolution gate (API-09, API-10, API-11)", () => {
  it("blocks RESOLVED while an Action Taken has an open follow-up (AC-04, BR-11)", async () => {
    const { ticketId, updatedAt } = await newOwnedTicket("Resolution gate — open follow-up");
    await staffAgent.post(`/api/staff/tickets/${ticketId}/actions`).send({
      description: "Investigated the issue.",
      result: "Needs a vendor callback.",
      followUpRequired: true,
      followUpNote: "Call the vendor back tomorrow.",
    });

    const res = await patchStatus(ticketId, "RESOLVED", updatedAt);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("RESOLUTION_BLOCKED");
    expect(res.body.error.blockingActions).toHaveLength(1);
    expect(res.body.error.blockingActions[0]).toMatchObject({ description: "Investigated the issue." });
  });

  it("blocks RESOLVED with zero Actions Taken (AC-05, BR-12)", async () => {
    const { ticketId, updatedAt } = await newOwnedTicket("Resolution gate — zero actions");

    const res = await patchStatus(ticketId, "RESOLVED", updatedAt);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("RESOLUTION_BLOCKED");
    expect(res.body.error.blockingActions).toEqual([]);
  });

  it("allows RESOLVED once the open follow-up is cleared (AC-06)", async () => {
    const { ticketId, updatedAt } = await newOwnedTicket("Resolution gate — cleared follow-up");
    const created = await staffAgent.post(`/api/staff/tickets/${ticketId}/actions`).send({
      description: "Investigated the issue.",
      result: "Needs a vendor callback.",
      followUpRequired: true,
      followUpNote: "Call the vendor back tomorrow.",
    });

    const stillBlocked = await patchStatus(ticketId, "RESOLVED", updatedAt);
    expect(stillBlocked.status).toBe(409);

    await staffAgent.patch(`/api/staff/tickets/${ticketId}/actions/${created.body.id}`).send({
      followUpRequired: false,
      updatedAt: created.body.updatedAt,
    });

    const res = await patchStatus(ticketId, "RESOLVED", updatedAt);
    expect(res.status).toBe(200);
    expect(res.body.currentStatus).toBe("RESOLVED");
  });
});

describe("Status change concurrency (API-12, API-13)", () => {
  it("rejects a status change with a stale Ticket updatedAt (AC-07, BR-14)", async () => {
    const { ticketId, updatedAt } = await newOwnedTicket("Stale status change");

    // First change succeeds and moves updatedAt forward.
    const first = await patchStatus(ticketId, "WAITING_FOR_REQUESTER", updatedAt);
    expect(first.status).toBe(200);

    // Second change still carries the original (now stale) updatedAt.
    const stale = await patchStatus(ticketId, "RESOLVED", updatedAt);
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("STALE_UPDATE");

    const current = await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticketId } });
    expect(current.currentStatus).toBe("WAITING_FOR_REQUESTER");
  });

  it("walks a full matrix-valid sequence carrying updatedAt at every step (Sec. 5.5)", async () => {
    const { ticketId, updatedAt: afterInProgress } = await newOwnedTicket("Full sequence with updatedAt");

    const toWaiting = await patchStatus(ticketId, "WAITING_FOR_REQUESTER", afterInProgress);
    expect(toWaiting.status).toBe(200);
    const afterWaiting = (await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticketId } })).updatedAt.toISOString();

    await staffAgent.post(`/api/staff/tickets/${ticketId}/actions`).send({
      description: "Resolved the issue with the Requester.",
      result: "Confirmed working.",
      followUpRequired: false,
    });

    const toResolved = await patchStatus(ticketId, "RESOLVED", afterWaiting);
    expect(toResolved.status).toBe(200);
    const afterResolved = (await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticketId } })).updatedAt.toISOString();

    const toClosed = await patchStatus(ticketId, "CLOSED", afterResolved);
    expect(toClosed.status).toBe(200);
  });
});
