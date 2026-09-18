const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export type Role = "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";

export interface AdminUserDto {
  id: number;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
}

export class ConflictError extends Error {
  field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.field = field;
  }
}

async function parseErrorAndThrow(res: Response): Promise<never> {
  const body = await res.json().catch(() => ({ error: "Something went wrong" }));
  if (res.status === 409) {
    throw new ConflictError(body.error || "Conflict", body.field);
  }
  throw new Error(body.error || "Something went wrong");
}

export async function fetchUsers(query: { search?: string; role?: Role | "" }): Promise<AdminUserDto[]> {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.role) params.set("role", query.role);

  const res = await fetch(`${API_URL}/api/admin/users?${params.toString()}`, { credentials: "include" });
  if (!res.ok) throw new Error("Unable to load users");
  return res.json();
}

export interface CreateUserInput {
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  initialPassword: string;
}

export async function createUser(input: CreateUserInput): Promise<AdminUserDto> {
  const res = await fetch(`${API_URL}/api/admin/users`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) return parseErrorAndThrow(res);
  return res.json();
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  role?: Role;
  isActive?: boolean;
}

export async function updateUser(id: number, input: UpdateUserInput): Promise<AdminUserDto> {
  const res = await fetch(`${API_URL}/api/admin/users/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) return parseErrorAndThrow(res);
  return res.json();
}

export async function resetPassword(id: number, newPassword: string): Promise<{ success: boolean; mustChangePassword: boolean }> {
  const res = await fetch(`${API_URL}/api/admin/users/${id}/reset-password`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newPassword }),
  });
  if (!res.ok) return parseErrorAndThrow(res);
  return res.json();
}
