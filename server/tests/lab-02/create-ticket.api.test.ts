import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { loginAsAgent } from "../lab-03/helpers.js";

let activeRequesterEmail: string;
let categoryId: number;
let relatedSystemId: number;
let agent: ReturnType<typeof request.agent>;

beforeAll(async () => {
  const prisma = getPrisma();
  const requester = await prisma.user.findFirst({ where: { isActive: true, role: "REQUESTER" } });
  const category = await prisma.category.findFirst();
  const relatedSystem = await prisma.relatedSystem.findFirst({ where: { isActive: true } });

  if (!requester || !category || !relatedSystem) {
    throw new Error("Seed data missing — run `npm run prisma:seed` before running tests.");
  }

  activeRequesterEmail = requester.email;
  categoryId = category.id;
  relatedSystemId = relatedSystem.id;
  agent = await loginAsAgent(activeRequesterEmail);
});

describe("POST /api/tickets", () => {
  it("creates a ticket with valid data and returns the generated ticket number (AC-01)", async () => {
    const res = await agent.post("/api/tickets").send({
      categoryId,
      relatedSystemId,
      summary: "Laptop battery drains quickly",
      description: "My laptop battery is draining much faster than usual.",
      requestedPriority: "MEDIUM",
    });

    expect(res.status).toBe(201);
    expect(res.body.ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/);
    expect(res.body.currentStatus).toBe("NEW");
  });

  // AC-04/BR-09: the session's own id owns the ticket, not a spoofed one in the body.
  it("ignores a spoofed requesterId in the request body (AC-04, BR-09)", async () => {
    const res = await agent.post("/api/tickets").send({
      requesterId: 999999,
      categoryId,
      relatedSystemId,
      summary: "Spoofed requesterId attempt",
      description: "This should be owned by the session user, not id 999999.",
      requestedPriority: "MEDIUM",
    });

    expect(res.status).toBe(201);
    expect(res.body.requesterId).not.toBe(999999);
  });

  it("rejects an empty Summary with a field-level error (AC-04)", async () => {
    const res = await agent.post("/api/tickets").send({
      categoryId,
      relatedSystemId,
      summary: "",
      description: "Valid description text here.",
      requestedPriority: "MEDIUM",
    });

    expect(res.status).toBe(400);
    expect(res.body.fields.summary).toBeDefined();
  });

  it("rejects an unauthenticated request with no session (AC-19)", async () => {
    const res = await request(app).post("/api/tickets").send({
      categoryId,
      relatedSystemId,
      summary: "Valid summary here",
      description: "Valid description text here.",
      requestedPriority: "MEDIUM",
    });

    expect(res.status).toBe(401);
  });
});
