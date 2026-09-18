import { Router, Request, Response } from "express";
import { getPrisma } from "./prisma.js";
import {
  DUMMY_PASSWORD_HASH,
  SESSION_COOKIE_NAME,
  hashPassword,
  passwordRuleFailures,
  sessionCookieOptions,
  signSessionToken,
  verifyPassword,
} from "./auth.js";
import { requireAuth } from "./authMiddleware.js";

export const authRouter = Router();

// AC-01/AC-02, BR-01: one generic message for both wrong password and an
// inactive account — never reveal which case it was.
authRouter.post("/login", async (req: Request, res: Response) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const user = await getPrisma().user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });

    // Always run bcrypt.compare — against the real hash when the user
    // exists, or a fixed dummy hash when they don't/are inactive — so an
    // unknown email and a wrong password take comparably long (BR-01).
    const passwordOk = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
    if (!user || !user.isActive || !passwordOk) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = signSessionToken({ userId: user.id });
    res.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions());
    res.status(200).json({
      id: user.id,
      name: user.name,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    });
  } catch (err) {
    console.error("Login failed:", err);
    res.status(500).json({ error: "Unable to sign in" });
  }
});

authRouter.post("/logout", requireAuth, (_req: Request, res: Response) => {
  res.clearCookie(SESSION_COOKIE_NAME);
  res.status(200).json({ success: true });
});

authRouter.get("/me", requireAuth, (req: Request, res: Response) => {
  res.status(200).json(req.user);
});

// BR-07/BR-08: rule-checked new password; clears mustChangePassword without
// forcing re-login.
authRouter.post("/change-password", requireAuth, async (req: Request, res: Response) => {
  const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
  const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current and new password are required" });
  }

  try {
    const user = await getPrisma().user.findUnique({ where: { id: req.user!.id } });
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const currentOk = await verifyPassword(currentPassword, user.passwordHash);
    if (!currentOk) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const failures = passwordRuleFailures(newPassword);
    if (failures.length > 0) {
      return res.status(400).json({ error: failures[0], failures });
    }

    if (newPassword === currentPassword) {
      return res.status(400).json({ error: "New password must be different from the current password" });
    }

    const passwordHash = await hashPassword(newPassword);
    await getPrisma().user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false },
    });

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Change password failed:", err);
    res.status(500).json({ error: "Unable to change password" });
  }
});
