import { NextFunction, Request, Response } from "express";
import { getPrisma } from "./prisma.js";
import { SESSION_COOKIE_NAME, verifySessionToken } from "./auth.js";

export interface AuthenticatedUser {
  id: number;
  name: string;
  email: string;
  role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
  mustChangePassword: boolean;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthenticatedUser;
  }
}

// BR-01: re-checks isActive on every request (not just at login) so a
// deactivated account is rejected immediately, not just at its next login.
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  const payload = typeof token === "string" ? verifySessionToken(token) : null;
  if (!payload) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const user = await getPrisma().user.findUnique({ where: { id: payload.userId } });
  if (!user || !user.isActive) {
    return res.status(401).json({ error: "Authentication required" });
  }

  req.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  };
  next();
}

// BR-06: everything except login/logout/me/change-password is blocked
// until a pending password change is completed.
export function requirePasswordChangeComplete(req: Request, res: Response, next: NextFunction) {
  if (req.user?.mustChangePassword) {
    return res.status(403).json({ error: "Password change required" });
  }
  next();
}

export function requireRole(...roles: AuthenticatedUser["role"][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}
