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
  const staff = await prisma.user.findFirst({ where: { isActive: true, role: "IT_STAFF" }, orderBy: { id: "asc" } });
  const requester = await prisma.user.findFirst({ where: { isActive: true, role: "REQUESTER" }, orderBy: { id: "asc" } });
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
    const { ticketId } = await newOwnedTicket("Resolution gate — open follow-up");
    await staffAgent.post(`/api/staff/tickets/${ticketId}/actions`).send({
      description: "Investigated the issue.",
      result: "Needs a vendor callback.",
      followUpRequired: true,
      followUpNote: "Call the vendor back tomorrow.",
    });

    // Recording the Action Taken above bumped the Ticket's own updatedAt
    // (PR #58 fix), so the status check needs a fresh copy, not the one
    // newOwnedTicket returned before the action existed.
    const afterAction = await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticketId } });
    const res = await patchStatus(ticketId, "RESOLVED", afterAction.updatedAt.toISOString());
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
    const { ticketId } = await newOwnedTicket("Resolution gate — cleared follow-up");
    const created = await staffAgent.post(`/api/staff/tickets/${ticketId}/actions`).send({
      description: "Investigated the issue.",
      result: "Needs a vendor callback.",
      followUpRequired: true,
      followUpNote: "Call the vendor back tomorrow.",
    });

    // The Action Taken write above bumped the Ticket's own updatedAt
    // (PR #58 fix) — refetch before each status check below, matching what
    // the real client now does by reloading after every Action Taken edit.
    const afterCreate = await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticketId } });
    const stillBlocked = await patchStatus(ticketId, "RESOLVED", afterCreate.updatedAt.toISOString());
    expect(stillBlocked.status).toBe(409);
    expect(stillBlocked.body.error.code).toBe("RESOLUTION_BLOCKED");

    await staffAgent.patch(`/api/staff/tickets/${ticketId}/actions/${created.body.id}`).send({
      followUpRequired: false,
      updatedAt: created.body.updatedAt,
    });

    const afterClear = await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticketId } });
    const res = await patchStatus(ticketId, "RESOLVED", afterClear.updatedAt.toISOString());
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

  // Review of PR #56: the sequential stale-updatedAt test above only
  // exercises the early read-then-compare rejection. Firing both requests
  // together instead exercises the real race, but which of the two
  // rejection paths (the early read-then-compare, or the atomic updateMany's
  // count===0) catches the loser depends on request scheduling and isn't
  // guaranteed by this test — either is a correct outcome, so this only
  // asserts on the externally observable result (one 200, one 409 STALE_UPDATE).
  it("lets exactly one of two simultaneous status changes win (BR-14)", async () => {
    const { ticketId, updatedAt } = await newOwnedTicket("Simultaneous status changes");

    const [a, b] = await Promise.all([
      patchStatus(ticketId, "WAITING_FOR_REQUESTER", updatedAt),
      patchStatus(ticketId, "CANCELLED", updatedAt),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);
    const loser = a.status === 409 ? a : b;
    expect(loser.body.error.code).toBe("STALE_UPDATE");

    const current = await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticketId } });
    expect(["WAITING_FOR_REQUESTER", "CANCELLED"]).toContain(current.currentStatus);
  });

  // Review of PR #58: this is the race the fix closes — a concurrent Action
  // Taken write must not let a status change through on a now-stale gate
  // decision. Firing them together can't force a specific interleaving, so
  // this only asserts the externally observable guarantee: a RESOLVE that
  // raced against an Action Taken edit clearing the only open follow-up
  // lands on exactly one of two acceptable end states — resolved with the
  // follow-up cleared, or correctly rejected as stale.
  it("closes the race between a RESOLVE and a concurrent Action Taken edit (PR #58)", async () => {
    const { ticketId, updatedAt } = await newOwnedTicket("Actions-taken vs status race");
    const created = await staffAgent.post(`/api/staff/tickets/${ticketId}/actions`).send({
      description: "Investigated the issue.",
      result: "Needs a vendor callback.",
      followUpRequired: true,
      followUpNote: "Call the vendor back tomorrow.",
    });

    const [resolve, clearFollowUp] = await Promise.all([
      patchStatus(ticketId, "RESOLVED", updatedAt),
      staffAgent
        .patch(`/api/staff/tickets/${ticketId}/actions/${created.body.id}`)
        .send({ followUpRequired: false, updatedAt: created.body.updatedAt }),
    ]);

    expect(clearFollowUp.status).toBe(200);
    expect([200, 409]).toContain(resolve.status);
    if (resolve.status === 409) {
      expect(resolve.body.error.code).toBe("STALE_UPDATE");
    }

    const current = await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticketId } });
    if (resolve.status === 200) {
      expect(current.currentStatus).toBe("RESOLVED");
    } else {
      expect(current.currentStatus).toBe("IN_PROGRESS");
    }
  });

  it("walks a full matrix-valid sequence carrying updatedAt at every step (Sec. 5.5)", async () => {
    const { ticketId, updatedAt: afterInProgress } = await newOwnedTicket("Full sequence with updatedAt");

    const toWaiting = await patchStatus(ticketId, "WAITING_FOR_REQUESTER", afterInProgress);
    expect(toWaiting.status).toBe(200);

    await staffAgent.post(`/api/staff/tickets/${ticketId}/actions`).send({
      description: "Resolved the issue with the Requester.",
      result: "Confirmed working.",
      followUpRequired: false,
    });

    // The Action Taken write above bumped the Ticket's own updatedAt
    // (PR #58 fix), so a fresh copy is needed here rather than carrying the
    // pre-action `afterInProgress`/post-WAITING timestamp forward.
    const afterAction = (await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticketId } })).updatedAt.toISOString();
    const toResolved = await patchStatus(ticketId, "RESOLVED", afterAction);
    expect(toResolved.status).toBe(200);
    const afterResolved = (await getPrisma().ticket.findUniqueOrThrow({ where: { id: ticketId } })).updatedAt.toISOString();

    const toClosed = await patchStatus(ticketId, "CLOSED", afterResolved);
    expect(toClosed.status).toBe(200);
  });
});
