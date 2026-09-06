const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface CategoryDto {
  id: number;
  name: string;
}

export interface RelatedSystemDto {
  id: number;
  name: string;
}

export interface CreateTicketInput {
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  description: string;
  requestedPriority: "LOW" | "MEDIUM" | "HIGH";
}

export interface CreateTicketFieldErrors {
  [field: string]: string;
}

export class TicketValidationError extends Error {
  fields: CreateTicketFieldErrors;
  constructor(fields: CreateTicketFieldErrors) {
    super("Validation failed");
    this.fields = fields;
  }
}

export async function fetchCategories(): Promise<CategoryDto[]> {
  const res = await fetch(`${API_URL}/api/categories`);
  if (!res.ok) throw new Error("Unable to load categories");
  return res.json();
}

export async function fetchRelatedSystems(): Promise<RelatedSystemDto[]> {
  const res = await fetch(`${API_URL}/api/related-systems`);
  if (!res.ok) throw new Error("Unable to load related systems");
  return res.json();
}

export async function createTicket(requesterId: number, input: CreateTicketInput) {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/tickets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requester-Id": String(requesterId),
      },
      body: JSON.stringify(input),
    });
  } catch {
    // Network-level failure (backend unreachable) — never show the raw
    // browser error (e.g. "Failed to fetch") to the user.
    throw new Error("Unable to reach the server. Please check your connection and try again.");
  }

  if (res.status === 400) {
    const body = await res.json();
    if (body.fields) {
      throw new TicketValidationError(body.fields);
    }
    throw new Error(body.error || "Unable to create ticket");
  }

  if (!res.ok) {
    throw new Error("Unable to create ticket. Please try again.");
  }

  return res.json();
}