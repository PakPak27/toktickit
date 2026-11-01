import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { getPrisma } from "../../src/prisma.js";
import { loginAsAgent } from "../lab-03/helpers.js";

const RUN_ID = Date.now();
const PASSWORD = "DashTest1!";

let adminAgent: ReturnType<typeof request.agent>;
let staffAgent: ReturnType<typeof request.agent>;
let requesterA: ReturnType<typeof request.agent>;
let requesterB: ReturnType<typeof request.agent>;
let requesterZero: ReturnType<typeof request.agent>;
let staffId: number;
let categoryId: number;
let relatedSystemId: number;

async function createRequester(email: string) {
  const res = await adminAgent.post("/api/admin/users").send({
    name: `Dashboard Test ${email}`,
    email,
    role: "REQUESTER",
    isActive: true,
    initialPassword: PASSWORD,
  });
  if (res.status !== 201) throw new Error(`Could not create ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return loginAsAgent(email, PASSWORD);
}

async function createTicket(agent: ReturnType<typeof request.agent>, summary: string) {
  const res = await agent.post("/api/tickets").send({
    categoryId,
    relatedSystemId,
    summary,
    description: `A sufficiently long description for "${summary}".`,
    requestedPriority: "LOW",
  });
  return res.body.id as number;
}

beforeAll(async () => {
  const prisma = getPrisma();
  // orderBy id: other test files create throwaway Administrator/IT Staff
  // accounts without cleanup, so an unordered findFirst can non-
  // deterministically return one of those instead of the real seeded user.
  const admin = await prisma.user.findFirst({ where: { isActive: true, role: "ADMINISTRATOR" }, orderBy: { id: "asc" } });
  const staff = await prisma.user.findFirst({ where: { isActive: true, role: "IT_STAFF" }, orderBy: { id: "asc" } });
  const category = await prisma.category.findFirst();
  const relatedSystem = await prisma.relatedSystem.findFirst({ where: { isActive: true } });
  if (!admin || !staff || !category || !relatedSystem) {
    throw new Error("Seed data missing — run `npm run prisma:seed` before running tests.");
  }

  staffId = staff.id;
  categoryId = category.id;
  relatedSystemId = relatedSystem.id;
  adminAgent = await loginAsAgent(admin.email);
  staffAgent = await loginAsAgent(staff.email);

  requesterA = await createRequester(`dash-a-${RUN_ID}@example.com`);
  requesterB = await createRequester(`dash-b-${RUN_ID}@example.com`);
  requesterZero = await createRequester(`dash-zero-${RUN_ID}@example.com`);

  // Requester A: one of each status the Requester dashboard counts.
  const newId = await createTicket(requesterA, "Dash A - new");
  const openId = await createTicket(requesterA, "Dash A - open");
  await staffAgent.patch(`/api/staff/tickets/${openId}/owner`).send({ ticketOwnerId: staffId });
  const openTicket = await prisma.ticket.findUniqueOrThrow({ where: { id: openId } });
  await staffAgent.patch(`/api/staff/tickets/${openId}/status`).send({ currentStatus: "OPEN", updatedAt: openTicket.updatedAt.toISOString() });

  const waitingId = await createTicket(requesterA, "Dash A - waiting");
  await staffAgent.patch(`/api/staff/tickets/${waitingId}/owner`).send({ ticketOwnerId: staffId });
  const t1 = await prisma.ticket.findUniqueOrThrow({ where: { id: waitingId } });
  await staffAgent.patch(`/api/staff/tickets/${waitingId}/status`).send({ currentStatus: "IN_PROGRESS", updatedAt: t1.updatedAt.toISOString() });
  const t2 = await prisma.ticket.findUniqueOrThrow({ where: { id: waitingId } });
  await staffAgent.patch(`/api/staff/tickets/${waitingId}/status`).send({ currentStatus: "WAITING_FOR_REQUESTER", updatedAt: t2.updatedAt.toISOString() });

  const resolvedId = await createTicket(requesterA, "Dash A - resolved");
  await staffAgent.patch(`/api/staff/tickets/${resolvedId}/owner`).send({ ticketOwnerId: staffId });
  const t3 = await prisma.ticket.findUniqueOrThrow({ where: { id: resolvedId } });
  await staffAgent.patch(`/api/staff/tickets/${resolvedId}/status`).send({ currentStatus: "IN_PROGRESS", updatedAt: t3.updatedAt.toISOString() });
  await staffAgent.post(`/api/staff/tickets/${resolvedId}/actions`).send({
    description: "Resolved the issue.",
    result: "Confirmed working.",
    followUpRequired: false,
  });
  const t4 = await prisma.ticket.findUniqueOrThrow({ where: { id: resolvedId } });
  await staffAgent.patch(`/api/staff/tickets/${resolvedId}/status`).send({ currentStatus: "RESOLVED", updatedAt: t4.updatedAt.toISOString() });

  const closedId = await createTicket(requesterA, "Dash A - closed");
  await staffAgent.patch(`/api/staff/tickets/${closedId}/owner`).send({ ticketOwnerId: staffId });
  const t5 = await prisma.ticket.findUniqueOrThrow({ where: { id: closedId } });
  await staffAgent.patch(`/api/staff/tickets/${closedId}/status`).send({ currentStatus: "IN_PROGRESS", updatedAt: t5.updatedAt.toISOString() });
  await staffAgent.post(`/api/staff/tickets/${closedId}/actions`).send({
    description: "Resolved the issue.",
    result: "Confirmed working.",
    followUpRequired: false,
  });
  const t6 = await prisma.ticket.findUniqueOrThrow({ where: { id: closedId } });
  await staffAgent.patch(`/api/staff/tickets/${closedId}/status`).send({ currentStatus: "RESOLVED", updatedAt: t6.updatedAt.toISOString() });
  const t7 = await prisma.ticket.findUniqueOrThrow({ where: { id: closedId } });
  await staffAgent.patch(`/api/staff/tickets/${closedId}/status`).send({ currentStatus: "CLOSED", updatedAt: t7.updatedAt.toISOString() });

  void newId; // kept for readability; part of the "active" openCount only

  // Requester B: a single Ticket, to prove A never sees it.
  await createTicket(requesterB, "Dash B - isolated");
});

// Other test files look up "the" seeded Requester/IT Staff/Administrator
// with an unordered findFirst — leaving these throwaway Tickets/Users behind
// would silently become eligible matches for those lookups in later test
// files (exactly the bug this file's own beforeAll had to guard against).
afterAll(async () => {
  const prisma = getPrisma();
  const ticketIds = (
    await prisma.ticket.findMany({ where: { summary: { startsWith: "Dash " } }, select: { id: true } })
  ).map((t) => t.id);
  await prisma.actionTaken.deleteMany({ where: { ticketId: { in: ticketIds } } });
  await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
  await prisma.user.deleteMany({ where: { email: { contains: String(RUN_ID) } } });
});

describe("GET /api/dashboard/requester (API-14, API-16)", () => {
  it("scopes every metric and list to the caller's own Tickets (AC-09, BR-16)", async () => {
    const res = await requesterA.get("/api/dashboard/requester");
    expect(res.status).toBe(200);
    // New, Open, In Progress->Waiting, In Progress->Resolved are all "active"
    // except the two that finished (Resolved, Closed) — 3 active of 5 total.
    expect(res.body.metrics).toEqual({
      openCount: 3,
      inProgressCount: 0,
      waitingForRequesterCount: 1,
      resolvedCount: 1,
      closedCount: 1,
    });
    expect(res.body.recentTickets).toHaveLength(5);
    expect(res.body.attentionTickets).toHaveLength(1);
    expect(res.body.attentionTickets[0].summary).toBe("Dash A - waiting");
    expect(res.body.recentTickets.every((t: { summary: string }) => t.summary.startsWith("Dash A"))).toBe(true);

    const resB = await requesterB.get("/api/dashboard/requester");
    expect(resB.body.metrics.openCount).toBe(1);
    expect(resB.body.recentTickets).toHaveLength(1);
  });

  it("is forbidden for IT Staff (BR-16)", async () => {
    const res = await staffAgent.get("/api/dashboard/requester");
    expect(res.status).toBe(403);
  });

  it("returns every metric as 0 and empty lists for a Requester with no Tickets (AC-11)", async () => {
    const res = await requesterZero.get("/api/dashboard/requester");
    expect(res.status).toBe(200);
    expect(res.body.metrics).toEqual({
      openCount: 0,
      inProgressCount: 0,
      waitingForRequesterCount: 0,
      resolvedCount: 0,
      closedCount: 0,
    });
    expect(res.body.recentTickets).toEqual([]);
    expect(res.body.attentionTickets).toEqual([]);
  });
});
