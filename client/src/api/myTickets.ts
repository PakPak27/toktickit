const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface TicketListItem {
  id: number;
  ticketNumber: string;
  summary: string;
  categoryId: number;
  requestedPriority: "LOW" | "MEDIUM" | "HIGH";
  itPriority: "LOW" | "MEDIUM" | "HIGH" | null;
  currentStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface TicketListResponse {
  data: TicketListItem[];
  pagination: Pagination;
}

export interface TicketListQuery {
  search?: string;
  categoryId?: number;
  requestedPriority?: string;
  currentStatus?: string;
  sort?: string;
  order?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export async function fetchMyTickets(
  requesterId: number,
  query: TicketListQuery
): Promise<TicketListResponse> {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  });

  const res = await fetch(`${API_URL}/api/tickets?${params.toString()}`, {
    headers: { "X-Requester-Id": String(requesterId) },
  });

  if (!res.ok) {
    throw new Error("Unable to load your tickets. Please try again.");
  }

  return res.json();
}