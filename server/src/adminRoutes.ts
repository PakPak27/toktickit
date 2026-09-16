import { Router, Request, Response } from "express";
import { getPrisma } from "./prisma.js";
import { hashPassword, passwordRuleFailures } from "./auth.js";
import type { Role } from "@prisma/client";

export const adminRouter = Router();

const KNOWN_ROLES: string[] = ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"];

function serializeUser(u: { id: number; name: string; email: string; role: string; isActive: boolean }) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, isActive: u.isActive };
}

// BR-28 to BR-35: minimalist Administrator user management. Mounted with
// requireAuth/requirePasswordChangeComplete/requireRole("ADMINISTRATOR")
// already applied in app.ts, so every handler below runs as an active
// Administrator with req.user set.

// GET /api/admin/users — search by name/email, optional exact role filter.
// No pagination or multi-column sort (handout §8.5 explicitly excludes them).
adminRouter.get("/users", async (req: Request, res: Response) => {
  try {
    const where: Record<string, unknown> = {};
    if (req.query.search) {
      const search = String(req.query.search);
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }
    if (req.query.role && KNOWN_ROLES.includes(String(req.query.role))) {
      where.role = String(req.query.role);
    }

    const users = await getPrisma().user.findMany({ where, orderBy: { name: "asc" } });
    res.status(200).json(users.map(serializeUser));
  } catch (err) {
    console.error("Failed to fetch users:", err);
    res.status(500).json({ error: "Unable to load users" });
  }
});

// POST /api/admin/users — create with exactly one role and an initial password.
adminRouter.post("/users", async (req: Request, res: Response) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const role = req.body?.role;
  const isActive = typeof req.body?.isActive === "boolean" ? req.body.isActive : true;
  const initialPassword = typeof req.body?.initialPassword === "string" ? req.body.initialPassword : "";

  if (!name || !email) {
    return res.status(400).json({ error: "Name and email are required" });
  }
  if (!KNOWN_ROLES.includes(role)) {
    return res.status(400).json({ error: "role must be REQUESTER, IT_STAFF, or ADMINISTRATOR" });
  }
  const passwordFailures = passwordRuleFailures(initialPassword);
  if (passwordFailures.length > 0) {
    return res.status(400).json({ error: passwordFailures[0], fields: { initialPassword: passwordFailures } });
  }

  try {
    const existing = await getPrisma().user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
    if (existing) {
      return res.status(409).json({ error: "This email is already in use", field: "email" });
    }

    const passwordHash = await hashPassword(initialPassword);
    const created = await getPrisma().user.create({
      data: { name, email, role: role as Role, isActive, passwordHash, mustChangePassword: true },
    });

    res.status(201).json(serializeUser(created));
  } catch (err) {
    console.error("Failed to create user:", err);
    res.status(500).json({ error: "Unable to create user" });
  }
});

// BR-32/BR-33: would this update leave the system with no active Administrator?
async function wouldRemoveLastActiveAdministrator(
  targetUser: { id: number; role: string; isActive: boolean },
  nextRole: string,
  nextIsActive: boolean
): Promise<boolean> {
  const staysActiveAdmin = nextRole === "ADMINISTRATOR" && nextIsActive;
  const wasActiveAdmin = targetUser.role === "ADMINISTRATOR" && targetUser.isActive;
  if (!wasActiveAdmin || staysActiveAdmin) return false;

  const otherActiveAdmins = await getPrisma().user.count({
    where: { role: "ADMINISTRATOR", isActive: true, id: { not: targetUser.id } },
  });
  return otherActiveAdmins === 0;
}

// PATCH /api/admin/users/:id — edit name/email/role/activation only.
adminRouter.patch("/users/:id", async (req: Request, res: Response) => {
  const userId = Number(req.params.id);
  if (Number.isNaN(userId)) {
    return res.status(404).json({ error: "User not found" });
  }

  try {
    const targetUser = await getPrisma().user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const nextRole = typeof req.body?.role === "string" ? req.body.role : targetUser.role;
    const nextIsActive = typeof req.body?.isActive === "boolean" ? req.body.isActive : targetUser.isActive;

    if (!KNOWN_ROLES.includes(nextRole)) {
      return res.status(400).json({ error: "role must be REQUESTER, IT_STAFF, or ADMINISTRATOR" });
    }

    // BR-32: an Administrator can never deactivate their own account,
    // regardless of how many other active Administrators exist.
    if (userId === req.user!.id && nextIsActive === false) {
      return res.status(409).json({ error: "You cannot deactivate your own account" });
    }
    // BR-33: the system must always keep at least one active Administrator.
    if (await wouldRemoveLastActiveAdministrator(targetUser, nextRole, nextIsActive)) {
      return res.status(409).json({ error: "Cannot remove the last active Administrator" });
    }

    const data: Record<string, unknown> = { role: nextRole, isActive: nextIsActive };
    if (typeof req.body?.name === "string" && req.body.name.trim()) {
      data.name = req.body.name.trim();
    }
    if (typeof req.body?.email === "string" && req.body.email.trim()) {
      const email = req.body.email.trim().toLowerCase();
      if (email !== targetUser.email.toLowerCase()) {
        const conflict = await getPrisma().user.findFirst({
          where: { email: { equals: email, mode: "insensitive" }, id: { not: userId } },
        });
        if (conflict) {
          return res.status(409).json({ error: "This email is already in use", field: "email" });
        }
      }
      data.email = email;
    }

    const updated = await getPrisma().user.update({ where: { id: userId }, data });
    res.status(200).json(serializeUser(updated));
  } catch (err) {
    console.error("Failed to update user:", err);
    res.status(500).json({ error: "Unable to update user" });
  }
});

// POST /api/admin/users/:id/reset-password — BR-31: forces mustChangePassword.
adminRouter.post("/users/:id/reset-password", async (req: Request, res: Response) => {
  const userId = Number(req.params.id);
  const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";

  if (Number.isNaN(userId)) {
    return res.status(404).json({ error: "User not found" });
  }
  const failures = passwordRuleFailures(newPassword);
  if (failures.length > 0) {
    return res.status(400).json({ error: failures[0], fields: { newPassword: failures } });
  }

  try {
    const targetUser = await getPrisma().user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const passwordHash = await hashPassword(newPassword);
    await getPrisma().user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: true },
    });

    res.status(200).json({ success: true, mustChangePassword: true });
  } catch (err) {
    console.error("Failed to reset password:", err);
    res.status(500).json({ error: "Unable to reset password" });
  }
});
