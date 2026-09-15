const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface StaffTicketListItem {
  id: number;
  ticketNumber: string;
  summary: string;
  categoryId: number;
  requestedPriority: "LOW" | "MEDIUM" | "HIGH";
  itPriority: "LOW" | "MEDIUM" | "HIGH" | null;
  currentStatus: string;
  ticketOwner: { id: number; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface StaffTicketListResponse {
  data: StaffTicketListItem[];
  pagination: Pagination;
}

export interface StaffTicketQueueQuery {
  search?: string;
  categoryId?: number;
  itPriority?: string;
  currentStatus?: string;
  owner?: "all" | "unassigned" | "mine";
  sort?: string;
  order?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export async function fetchStaffTickets(query: StaffTicketQueueQuery): Promise<StaffTicketListResponse> {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  });

  const res = await fetch(`${API_URL}/api/staff/tickets?${params.toString()}`, {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Unable to load the ticket queue. Please try again.");
  }

  return res.json();
}
