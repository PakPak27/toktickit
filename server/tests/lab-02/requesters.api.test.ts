import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

// Requires the DB to be migrated and seeded first (see Issue #2).
describe("GET /api/requesters", () => {
  it("returns only active development requesters", async () => {
    const res = await request(app).get("/api/requesters");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    // At least the 4 seeded active requesters must be present
    expect(res.body.length).toBeGreaterThanOrEqual(4);

    // The inactive seeded requester must never appear
    const names = res.body.map((r: { name: string }) => r.name);
    expect(names).not.toContain("Retired Account");

    // Shape check on the first item
    expect(res.body[0]).toHaveProperty("id");
    expect(res.body[0]).toHaveProperty("name");
    expect(res.body[0]).toHaveProperty("email");
  });
});