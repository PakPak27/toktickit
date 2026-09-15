import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword } from "../../src/auth.js";

const SEED_PASSWORD = "ChangeMe123!";
const ACTIVE_REQUESTER_EMAIL = "jennifer.anderson@example.com";
const INACTIVE_REQUESTER_EMAIL = "retired.account@example.com";

// A throwaway user, separate from seeded accounts, so the change-password
// test can safely mutate its password without affecting other tests or
// requiring the idempotent seed to be re-run afterward.
const CHANGE_PW_EMAIL = "lab3-change-pw-test@example.com";

describe("Auth API", () => {
  beforeAll(async () => {
    const passwordHash = await hashPassword(SEED_PASSWORD);
    await getPrisma().user.upsert({
      where: { email: CHANGE_PW_EMAIL },
      update: { passwordHash, mustChangePassword: true, isActive: true },
      create: {
        name: "Change PW Test",
        email: CHANGE_PW_EMAIL,
        passwordHash,
        role: "REQUESTER",
        isActive: true,
        mustChangePassword: true,
      },
    });
  });

  afterAll(async () => {
    await getPrisma().user.delete({ where: { email: CHANGE_PW_EMAIL } }).catch(() => {});
  });

  // API-01 / AC-01
  it("logs in an active user with valid credentials and sets a session cookie", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: ACTIVE_REQUESTER_EMAIL, password: SEED_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: "Jennifer Anderson", role: "REQUESTER" });
    const setCookie = res.headers["set-cookie"];
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie].filter(Boolean);
    expect(cookies.some((c: string) => c.startsWith("toktickit_session="))).toBe(true);
  });

  // API-02 / AC-02: wrong password and inactive account return identical bodies.
  it("rejects a wrong password and an inactive account with the same generic message", async () => {
    const wrongPassword = await request(app)
      .post("/api/auth/login")
      .send({ email: ACTIVE_REQUESTER_EMAIL, password: "totally-wrong" });
    const inactiveAccount = await request(app)
      .post("/api/auth/login")
      .send({ email: INACTIVE_REQUESTER_EMAIL, password: SEED_PASSWORD });

    expect(wrongPassword.status).toBe(401);
    expect(inactiveAccount.status).toBe(401);
    expect(wrongPassword.body).toEqual(inactiveAccount.body);
    expect(wrongPassword.body).toEqual({ error: "Invalid email or password" });
  });

  it("rejects login for an unknown email with the same generic message", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: SEED_PASSWORD });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Invalid email or password" });
  });

  // API-03 / AC-03: mustChangePassword gate + change-password clearing it.
  it("requires a valid current password and a rule-compliant new password, then clears mustChangePassword", async () => {
    const agent = request.agent(app);
    const login = await agent
      .post("/api/auth/login")
      .send({ email: CHANGE_PW_EMAIL, password: SEED_PASSWORD });
    expect(login.body.mustChangePassword).toBe(true);

    const wrongCurrent = await agent
      .post("/api/auth/change-password")
      .send({ currentPassword: "not-the-real-password", newPassword: "N3wSecret!Pass" });
    expect(wrongCurrent.status).toBe(401);

    const weakNew = await agent
      .post("/api/auth/change-password")
      .send({ currentPassword: SEED_PASSWORD, newPassword: "weak" });
    expect(weakNew.status).toBe(400);

    const success = await agent
      .post("/api/auth/change-password")
      .send({ currentPassword: SEED_PASSWORD, newPassword: "N3wSecret!Pass" });
    expect(success.status).toBe(200);
    expect(success.body).toEqual({ success: true });

    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.mustChangePassword).toBe(false);
  });

  // API-04 / AC-19: logout invalidates the session.
  it("invalidates the session on logout", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: ACTIVE_REQUESTER_EMAIL, password: SEED_PASSWORD });

    const meBeforeLogout = await agent.get("/api/auth/me");
    expect(meBeforeLogout.status).toBe(200);

    const logout = await agent.post("/api/auth/logout");
    expect(logout.status).toBe(200);
    expect(logout.body).toEqual({ success: true });

    const meAfterLogout = await agent.get("/api/auth/me");
    expect(meAfterLogout.status).toBe(401);
  });

  it("rejects /api/auth/me with no session at all", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });
});
