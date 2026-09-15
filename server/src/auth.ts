import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const SESSION_COOKIE_NAME = "toktickit_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60; // BR-04: 8 hours, no refresh in Lab 3

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set. Copy server/.env.example to server/.env and set it.");
  }
  return secret;
}

export interface SessionPayload {
  userId: number;
}

// BR-02: passwords are only ever persisted as a bcrypt hash.
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// BR-01: a fixed-cost hash to compare against when no real user/hash
// exists, so an unknown-email or inactive-account login takes the same
// bcrypt.compare() time as a wrong-password one — otherwise the early
// return before hashing is a timing side-channel that leaks whether an
// email is registered, even though both cases return an identical body.
export const DUMMY_PASSWORD_HASH = bcrypt.hashSync("not-a-real-password", 10);

// BR-03: signed JWT carried in an httpOnly, SameSite=Lax cookie.
export function signSessionToken(payload: SessionPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: SESSION_TTL_SECONDS });
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as SessionPayload;
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: SESSION_TTL_SECONDS * 1000,
  };
}

// BR-07: new password rules. Returns a list of unmet rules (empty = valid).
export function passwordRuleFailures(password: string): string[] {
  const failures: string[] = [];
  if (password.length < 8) failures.push("Password must be at least 8 characters");
  if (!/[a-z]/.test(password)) failures.push("Password must include a lowercase letter");
  if (!/[A-Z]/.test(password)) failures.push("Password must include an uppercase letter");
  if (!/[0-9]/.test(password)) failures.push("Password must include a digit");
  if (!/[^A-Za-z0-9]/.test(password)) failures.push("Password must include a special character");
  return failures;
}
