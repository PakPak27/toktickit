import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RequesterDashboard from "../../src/pages/RequesterDashboard.js";
import * as dashboardApi from "../../src/api/dashboard.js";
import { RequesterDashboardDto } from "../../src/api/dashboard.js";

function renderPage() {
  return render(
    <MemoryRouter>
      <RequesterDashboard />
    </MemoryRouter>
  );
}

const populated: RequesterDashboardDto = {
  metrics: { openCount: 3, inProgressCount: 1, waitingForRequesterCount: 2, resolvedCount: 4, closedCount: 5 },
  recentTickets: [
    { id: 1, ticketNumber: "TKT-2026-000001", summary: "Printer offline", currentStatus: "OPEN", updatedAt: new Date().toISOString() },
  ],
  attentionTickets: [
    { id: 2, ticketNumber: "TKT-2026-000002", summary: "Needs your input", currentStatus: "WAITING_FOR_REQUESTER", updatedAt: new Date().toISOString() },
  ],
};

const zero: RequesterDashboardDto = {
  metrics: { openCount: 0, inProgressCount: 0, waitingForRequesterCount: 0, resolvedCount: 0, closedCount: 0 },
  recentTickets: [],
  attentionTickets: [],
};

describe("RequesterDashboard (UI-06, UI-08, UI-09)", () => {
  it("renders metric counts with the correct drill-down links (AC-09, AC-12)", async () => {
    vi.spyOn(dashboardApi, "fetchRequesterDashboard").mockResolvedValue(populated);
    renderPage();

    expect(await screen.findByText("3")).toBeInTheDocument();
    const openLink = screen.getByRole("link", { name: /Open: 3/i });
    expect(openLink).toHaveAttribute("href", "/tickets?statusGroup=active");
    expect(screen.getByRole("link", { name: /Waiting for Requester: 2/i })).toHaveAttribute(
      "href",
      "/tickets?status=WAITING_FOR_REQUESTER"
    );
    expect(screen.getByRole("link", { name: /Resolved: 4/i })).toHaveAttribute("href", "/tickets?status=RESOLVED");
    expect(screen.getByRole("link", { name: /Closed: 5/i })).toHaveAttribute("href", "/tickets?status=CLOSED");
  });

  it("shows the attention list above the recent list, each row linking to the Ticket (AC-12)", async () => {
    vi.spyOn(dashboardApi, "fetchRequesterDashboard").mockResolvedValue(populated);
    renderPage();

    expect(await screen.findByText(/Needs your input/i)).toBeInTheDocument();
    expect(screen.getByText(/Printer offline/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Needs your input/i })).toHaveAttribute("href", "/tickets/2");
    expect(screen.getByText("Needs Your Attention")).toBeInTheDocument();
  });

  it("omits the attention list entirely when there is nothing waiting", async () => {
    vi.spyOn(dashboardApi, "fetchRequesterDashboard").mockResolvedValue({ ...populated, attentionTickets: [] });
    renderPage();

    await screen.findByText(/Printer offline/i);
    expect(screen.queryByText("Needs Your Attention")).not.toBeInTheDocument();
  });

  it("shows every metric as 0 and the create-a-ticket empty state when there are no Tickets at all (AC-11)", async () => {
    vi.spyOn(dashboardApi, "fetchRequesterDashboard").mockResolvedValue(zero);
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText("0")).toHaveLength(5);
    });
    expect(screen.getByText(/haven't created any tickets yet/i)).toBeInTheDocument();
    expect(screen.queryByText("Needs Your Attention")).not.toBeInTheDocument();
  });

  it("shows a loading state, then a safe failure banner with Retry (Sec. 4 ui-spec)", async () => {
    const spy = vi.spyOn(dashboardApi, "fetchRequesterDashboard").mockRejectedValueOnce(new Error("boom"));
    renderPage();

    expect(screen.getByText(/Loading your dashboard/i)).toBeInTheDocument();
    expect(await screen.findByText(/Unable to load your dashboard/i)).toBeInTheDocument();

    spy.mockResolvedValueOnce(populated);
    fireEvent.click(screen.getByRole("button", { name: /Retry/i }));

    await waitFor(() => expect(screen.getByText("3")).toBeInTheDocument());
  });
});
