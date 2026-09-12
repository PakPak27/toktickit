const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export type Role = "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";

export interface CurrentUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  mustChangePassword: boolean;
}

async function safeFetch(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, { ...init, credentials: "include" });
  } catch {
    throw new Error("Unable to reach the server. Please check your connection and try again.");
  }
}

export async function login(email: string, password: string): Promise<CurrentUser> {
  const res = await safeFetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Invalid email or password");
  }
  return res.json();
}

export async function logout(): Promise<void> {
  await safeFetch(`${API_URL}/api/auth/logout`, { method: "POST" });
}

export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  const res = await safeFetch(`${API_URL}/api/auth/me`);
  if (res.status === 401) return null;
  if (!res.ok) throw new Error("Unable to load your account");
  return res.json();
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const res = await safeFetch(`${API_URL}/api/auth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Unable to change password");
  }
}
