const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface DashboardTicketSummary {
  id: number;
  ticketNumber: string;
  summary: string;
  currentStatus: string;
  updatedAt: string;
}

export interface StaffDashboardTicketSummary extends DashboardTicketSummary {
  ticketOwnerName: string | null;
}

export interface RequesterDashboardDto {
  metrics: {
    openCount: number;
    inProgressCount: number;
    waitingForRequesterCount: number;
    resolvedCount: number;
    closedCount: number;
  };
  recentTickets: DashboardTicketSummary[];
  attentionTickets: DashboardTicketSummary[];
}

export interface StaffDashboardDto {
  metrics: {
    newCount: number;
    openCount: number;
    inProgressCount: number;
    waitingForRequesterCount: number;
    unassignedCount: number;
    myAssignedCount: number;
  };
  recentTickets: StaffDashboardTicketSummary[];
}

export async function fetchRequesterDashboard(): Promise<RequesterDashboardDto> {
  const res = await fetch(`${API_URL}/api/dashboard/requester`, { credentials: "include" });
  if (!res.ok) throw new Error("Unable to load your dashboard");
  return res.json();
}

export async function fetchStaffDashboard(): Promise<StaffDashboardDto> {
  const res = await fetch(`${API_URL}/api/dashboard/staff`, { credentials: "include" });
  if (!res.ok) throw new Error("Unable to load your dashboard");
  return res.json();
}
