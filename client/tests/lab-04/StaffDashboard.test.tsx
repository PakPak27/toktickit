import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import StaffDashboard from "../../src/pages/StaffDashboard.js";
import * as dashboardApi from "../../src/api/dashboard.js";
import { StaffDashboardDto } from "../../src/api/dashboard.js";

function renderPage() {
  return render(
    <MemoryRouter>
      <StaffDashboard />
    </MemoryRouter>
  );
}

const populated: StaffDashboardDto = {
  metrics: { newCount: 5, openCount: 3, inProgressCount: 2, waitingForRequesterCount: 1, unassignedCount: 4, myAssignedCount: 6 },
  recentTickets: [
    {
      id: 1,
      ticketNumber: "TKT-2026-000001",
      summary: "Printer offline",
      currentStatus: "OPEN",
      ticketOwnerName: "Priya Natarajan",
      updatedAt: new Date().toISOString(),
    },
    {
      id: 2,
      ticketNumber: "TKT-2026-000002",
      summary: "Unassigned issue",
      currentStatus: "NEW",
      ticketOwnerName: null,
      updatedAt: new Date().toISOString(),
    },
  ],
};

const zero: StaffDashboardDto = {
  metrics: { newCount: 0, openCount: 0, inProgressCount: 0, waitingForRequesterCount: 0, unassignedCount: 0, myAssignedCount: 0 },
  recentTickets: [],
};

describe("StaffDashboard (UI-07, UI-08, UI-09)", () => {
  it("renders metric counts with the correct drill-down links (AC-10, AC-12)", async () => {
    vi.spyOn(dashboardApi, "fetchStaffDashboard").mockResolvedValue(populated);
    renderPage();

    expect(await screen.findByText("5")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /New: 5/i })).toHaveAttribute("href", "/staff/queue?status=NEW");
    expect(screen.getByRole("link", { name: /Unassigned: 4/i })).toHaveAttribute("href", "/staff/queue?ownership=unassigned");
    expect(screen.getByRole("link", { name: /My Assigned: 6/i })).toHaveAttribute("href", "/staff/queue?ownership=mine");
  });

  it("shows the recent list with owner name or Unassigned, each row linking to the staff Ticket Detail", async () => {
    vi.spyOn(dashboardApi, "fetchStaffDashboard").mockResolvedValue(populated);
    renderPage();

    expect(await screen.findByText(/Printer offline/i)).toBeInTheDocument();
    expect(screen.getByText("Priya Natarajan")).toBeInTheDocument();
    expect(screen.getByText(/Unassigned issue/i)).toBeInTheDocument();
    // "Unassigned" appears both as the metric card's label and as this row's owner.
    expect(screen.getAllByText("Unassigned").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("link", { name: /Printer offline/i })).toHaveAttribute("href", "/staff/tickets/1");
  });

  it("shows every metric as 0 and the system-wide empty state with no Tickets (AC-11)", async () => {
    vi.spyOn(dashboardApi, "fetchStaffDashboard").mockResolvedValue(zero);
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText("0")).toHaveLength(6);
    });
    expect(screen.getByText(/No tickets in the system yet/i)).toBeInTheDocument();
  });

  it("shows a loading state, then a safe failure banner with Retry (Sec. 4 ui-spec)", async () => {
    const spy = vi.spyOn(dashboardApi, "fetchStaffDashboard").mockRejectedValueOnce(new Error("boom"));
    renderPage();

    expect(screen.getByText(/Loading your dashboard/i)).toBeInTheDocument();
    expect(await screen.findByText(/Unable to load your dashboard/i)).toBeInTheDocument();

    spy.mockResolvedValueOnce(populated);
    fireEvent.click(screen.getByRole("button", { name: /Retry/i }));

    await waitFor(() => expect(screen.getByText("5")).toBeInTheDocument());
  });
});
