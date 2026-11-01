import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { getPrisma } from "../../src/prisma.js";
import { loginAsAgent } from "../lab-03/helpers.js";

let staffAgent: ReturnType<typeof request.agent>;
let adminAgent: ReturnType<typeof request.agent>;
let requesterAgent: ReturnType<typeof request.agent>;
let staffId: number;

beforeAll(async () => {
  const prisma = getPrisma();
  // orderBy id: other test files create throwaway Administrator/IT Staff
  // accounts without cleanup, so an unordered findFirst can non-
  // deterministically return one of those instead of the real seeded user.
  const staff = await prisma.user.findFirst({ where: { isActive: true, role: "IT_STAFF" }, orderBy: { id: "asc" } });
  const admin = await prisma.user.findFirst({ where: { isActive: true, role: "ADMINISTRATOR" }, orderBy: { id: "asc" } });
  const requester = await prisma.user.findFirst({ where: { isActive: true, role: "REQUESTER" }, orderBy: { id: "asc" } });
  if (!staff || !admin || !requester) {
    throw new Error("Seed data missing — run `npm run prisma:seed` before running tests.");
  }

  staffId = staff.id;
  staffAgent = await loginAsAgent(staff.email);
  adminAgent = await loginAsAgent(admin.email);
  requesterAgent = await loginAsAgent(requester.email);
});

describe("GET /api/dashboard/staff (API-17, API-19)", () => {
  it("matches a direct database count for every metric (AC-10, BR-17)", async () => {
    const prisma = getPrisma();
    const res = await staffAgent.get("/api/dashboard/staff");
    expect(res.status).toBe(200);

    const [newCount, openCount, inProgressCount, waitingForRequesterCount, unassignedCount, myAssignedCount] = await Promise.all([
      prisma.ticket.count({ where: { currentStatus: "NEW" } }),
      prisma.ticket.count({ where: { currentStatus: "OPEN" } }),
      prisma.ticket.count({ where: { currentStatus: "IN_PROGRESS" } }),
      prisma.ticket.count({ where: { currentStatus: "WAITING_FOR_REQUESTER" } }),
      prisma.ticket.count({ where: { ticketOwnerId: null } }),
      prisma.ticket.count({ where: { ticketOwnerId: staffId } }),
    ]);

    expect(res.body.metrics).toEqual({ newCount, openCount, inProgressCount, waitingForRequesterCount, unassignedCount, myAssignedCount });
    expect(res.body.recentTickets.length).toBeLessThanOrEqual(5);
  });

  it("is forbidden for a Requester (BR-17)", async () => {
    const res = await requesterAgent.get("/api/dashboard/staff");
    expect(res.status).toBe(403);
  });

  it("gives an Administrator the identical response shape (FR-09)", async () => {
    const [staffRes, adminRes] = await Promise.all([staffAgent.get("/api/dashboard/staff"), adminAgent.get("/api/dashboard/staff")]);
    expect(adminRes.status).toBe(200);
    expect(Object.keys(adminRes.body).sort()).toEqual(Object.keys(staffRes.body).sort());
    expect(Object.keys(adminRes.body.metrics).sort()).toEqual(Object.keys(staffRes.body.metrics).sort());
  });

  it("includes the current owner's name on an assigned recent Ticket, or null when unassigned", async () => {
    const res = await staffAgent.get("/api/dashboard/staff");
    for (const t of res.body.recentTickets) {
      expect(t).toHaveProperty("ticketOwnerName");
      expect(typeof t.ticketOwnerName === "string" || t.ticketOwnerName === null).toBe(true);
    }
  });
});
