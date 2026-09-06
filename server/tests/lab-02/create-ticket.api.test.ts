import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

let activeRequesterId: number;
let categoryId: number;
let relatedSystemId: number;

beforeAll(async () => {
  const prisma = getPrisma();
  const requester = await prisma.requesterUser.findFirst({ where: { isActive: true } });
  const category = await prisma.category.findFirst();
  const relatedSystem = await prisma.relatedSystem.findFirst({ where: { isActive: true } });

  if (!requester || !category || !relatedSystem) {
    throw new Error("Seed data missing — run `npm run prisma:seed` before running tests.");
  }

  activeRequesterId = requester.id;
  categoryId = category.id;
  relatedSystemId = relatedSystem.id;
});

describe("POST /api/tickets", () => {
  it("creates a ticket with valid data and returns the generated ticket number (AC-01)", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", String(activeRequesterId))
      .send({
        categoryId,
        relatedSystemId,
        summary: "Laptop battery drains quickly",
        description: "My laptop battery is draining much faster than usual.",
        requestedPriority: "MEDIUM",
      });

    expect(res.status).toBe(201);
    expect(res.body.ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/);
    expect(res.body.requesterId).toBe(activeRequesterId);
    expect(res.body.currentStatus).toBe("NEW");
  });

  it("rejects an empty Summary with a field-level error (AC-04)", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", String(activeRequesterId))
      .send({
        categoryId,
        relatedSystemId,
        summary: "",
        description: "Valid description text here.",
        requestedPriority: "MEDIUM",
      });

    expect(res.status).toBe(400);
    expect(res.body.fields.summary).toBeDefined();
  });

  it("rejects a request with no X-Requester-Id header", async () => {
    const res = await request(app).post("/api/tickets").send({
      categoryId,
      relatedSystemId,
      summary: "Valid summary here",
      description: "Valid description text here.",
      requestedPriority: "MEDIUM",
    });

    expect(res.status).toBe(400);
  });
});