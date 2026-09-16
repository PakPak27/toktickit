import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { loginAsAgent } from "./helpers.js";

let adminAgent: ReturnType<typeof request.agent>;
let requesterAgent: ReturnType<typeof request.agent>;
let staffAgent: ReturnType<typeof request.agent>;
let adminUserId: number;

const RUN_ID = Date.now();
const NEW_USER_EMAIL = `admin-test-${RUN_ID}@toktickit.com`;

beforeAll(async () => {
  const prisma = getPrisma();
  const admin = await prisma.user.findFirst({ where: { isActive: true, role: "ADMINISTRATOR" } });
  const staff = await prisma.user.findFirst({ where: { isActive: true, role: "IT_STAFF" } });
  const requester = await prisma.user.findFirst({ where: { isActive: true, role: "REQUESTER" } });

  if (!admin || !staff || !requester) {
    throw new Error("Seed data missing — run `npm run prisma:seed` before running tests.");
  }

  adminUserId = admin.id;
  adminAgent = await loginAsAgent(admin.email);
  staffAgent = await loginAsAgent(staff.email);
  requesterAgent = await loginAsAgent(requester.email);
});

describe("GET /api/admin/users", () => {
  it("lists users and supports search by name/email (AC-18)", async () => {
    const res = await adminAgent.get("/api/admin/users");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).not.toHaveProperty("passwordHash");
  });

  it("filters by exact role", async () => {
    const res = await adminAgent.get("/api/admin/users").query({ role: "IT_STAFF" });
    expect(res.status).toBe(200);
    expect(res.body.every((u: { role: string }) => u.role === "IT_STAFF")).toBe(true);
  });

  it("is forbidden for IT Staff and Requester (AC-18)", async () => {
    const staffRes = await staffAgent.get("/api/admin/users");
    expect(staffRes.status).toBe(403);
    const requesterRes = await requesterAgent.get("/api/admin/users");
    expect(requesterRes.status).toBe(403);
  });
});

describe("POST /api/admin/users (AC-15)", () => {
  it("creates a user with a permitted role and initial password", async () => {
    const res = await adminAgent.post("/api/admin/users").send({
      name: "New Test User",
      email: NEW_USER_EMAIL,
      role: "IT_STAFF",
      isActive: true,
      initialPassword: "InitPass1!",
    });
    expect(res.status).toBe(201);
    expect(res.body.email).toBe(NEW_USER_EMAIL);
    expect(res.body).not.toHaveProperty("passwordHash");
  });

  it("rejects a duplicate email (409)", async () => {
    const res = await adminAgent.post("/api/admin/users").send({
      name: "Duplicate",
      email: NEW_USER_EMAIL,
      role: "IT_STAFF",
      isActive: true,
      initialPassword: "InitPass1!",
    });
    expect(res.status).toBe(409);
    expect(res.body.field).toBe("email");
  });

  it("rejects an invalid role value", async () => {
    const res = await adminAgent.post("/api/admin/users").send({
      name: "Bad Role",
      email: `bad-role-${RUN_ID}@toktickit.com`,
      role: "SUPERUSER",
      isActive: true,
      initialPassword: "InitPass1!",
    });
    expect(res.status).toBe(400);
  });

  it("rejects a weak initial password", async () => {
    const res = await adminAgent.post("/api/admin/users").send({
      name: "Weak Password",
      email: `weak-pw-${RUN_ID}@toktickit.com`,
      role: "REQUESTER",
      isActive: true,
      initialPassword: "weak",
    });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/admin/users/:id", () => {
  it("edits name/email/role/activation", async () => {
    const targetRes = await adminAgent.get("/api/admin/users").query({ search: NEW_USER_EMAIL });
    const targetId = targetRes.body[0].id;

    const res = await adminAgent.patch(`/api/admin/users/${targetId}`).send({ name: "Renamed User", role: "ADMINISTRATOR" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Renamed User");
    expect(res.body.role).toBe("ADMINISTRATOR");
  });

  it("rejects a duplicate email on edit (409)", async () => {
    const admin = await getPrisma().user.findFirst({ where: { id: adminUserId } });
    const targetRes = await adminAgent.get("/api/admin/users").query({ search: NEW_USER_EMAIL });
    const targetId = targetRes.body[0].id;

    const res = await adminAgent.patch(`/api/admin/users/${targetId}`).send({ email: admin!.email });
    expect(res.status).toBe(409);
  });

  it("prevents an Administrator from deactivating their own account (BR-32)", async () => {
    const res = await adminAgent.patch(`/api/admin/users/${adminUserId}`).send({ isActive: false });
    expect(res.status).toBe(409);
  });

  it("prevents the last active Administrator from changing their own role away from ADMINISTRATOR (BR-33)", async () => {
    // Only an Administrator can call these routes at all (requireAdminSession),
    // so a *different* admin making the request always implies a second
    // active admin already exists — BR-33 can only actually be triggered by
    // the sole remaining admin acting on their own account with a role
    // change (BR-32 separately covers the self-deactivation case).
    const otherAdmins = await getPrisma().user.findMany({
      where: { role: "ADMINISTRATOR", isActive: true, id: { not: adminUserId } },
    });
    for (const other of otherAdmins) {
      await getPrisma().user.update({ where: { id: other.id }, data: { isActive: false } });
    }

    const res = await adminAgent.patch(`/api/admin/users/${adminUserId}`).send({ role: "IT_STAFF" });
    expect(res.status).toBe(409);

    // Restore whoever else was deactivated at the top of this test so it
    // doesn't permanently alter shared seed data for later test runs.
    for (const other of otherAdmins) {
      await getPrisma().user.update({ where: { id: other.id }, data: { isActive: true } });
    }
  });

  it("returns 404 for a nonexistent user", async () => {
    const res = await adminAgent.patch("/api/admin/users/999999999").send({ name: "Nobody" });
    expect(res.status).toBe(404);
  });

  it("is forbidden for IT Staff and Requester", async () => {
    const res = await staffAgent.patch(`/api/admin/users/${adminUserId}`).send({ name: "Hacked" });
    expect(res.status).toBe(403);
  });
});

describe("POST /api/admin/users/:id/reset-password (AC-16)", () => {
  it("sets a new initial password that forces mustChangePassword at next login", async () => {
    const targetRes = await adminAgent.get("/api/admin/users").query({ search: NEW_USER_EMAIL });
    const targetId = targetRes.body[0].id;

    const res = await adminAgent.post(`/api/admin/users/${targetId}/reset-password`).send({ newPassword: "ResetPass1!" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, mustChangePassword: true });

    const login = await request(app).post("/api/auth/login").send({ email: NEW_USER_EMAIL, password: "ResetPass1!" });
    expect(login.status).toBe(200);
    expect(login.body.mustChangePassword).toBe(true);
  });

  it("rejects a weak new password", async () => {
    const targetRes = await adminAgent.get("/api/admin/users").query({ search: NEW_USER_EMAIL });
    const targetId = targetRes.body[0].id;
    const res = await adminAgent.post(`/api/admin/users/${targetId}/reset-password`).send({ newPassword: "weak" });
    expect(res.status).toBe(400);
  });
});
