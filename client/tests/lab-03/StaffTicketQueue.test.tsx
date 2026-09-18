import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import StaffTicketQueue from "../../src/pages/StaffTicketQueue.js";
import * as staffQueueApi from "../../src/api/staffQueue.js";
import * as ticketsApi from "../../src/api/tickets.js";

function renderPage() {
  return render(
    <BrowserRouter>
      <StaffTicketQueue />
    </BrowserRouter>
  );
}

const sampleTicket = {
  id: 1,
  ticketNumber: "TKT-2026-000001",
  summary: "Laptop battery drains quickly",
  categoryId: 1,
  requestedPriority: "MEDIUM" as const,
  itPriority: null,
  currentStatus: "NEW",
  ticketOwner: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("StaffTicketQueue (UI-07)", () => {
  beforeEach(() => {
    vi.spyOn(ticketsApi, "fetchCategories").mockResolvedValue([{ id: 1, name: "Hardware" }]);
  });

  it("shows a system-wide empty state when there are no tickets and no filters", async () => {
    vi.spyOn(staffQueueApi, "fetchStaffTickets").mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 1 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/No tickets in the system yet/i)).toBeInTheDocument();
    });
  });

  it("shows a distinct no-results state when a filter matches nothing", async () => {
    vi.spyOn(staffQueueApi, "fetchStaffTickets").mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 1 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/No tickets in the system yet/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/Search by ticket number or summary/i), {
      target: { value: "zzzz-no-match" },
    });

    await waitFor(() => {
      expect(screen.getByText(/No tickets match your filters/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/No tickets in the system yet/i)).not.toBeInTheDocument();
  });

  it("shows Unassigned for a ticket with no owner, across all Requesters", async () => {
    const fetchSpy = vi.spyOn(staffQueueApi, "fetchStaffTickets").mockResolvedValue({
      data: [sampleTicket],
      pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText("TKT-2026-000001").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("Unassigned").length).toBeGreaterThan(0);
    // No requesterId/ownership filter is passed by the client — the
    // backend already scopes this endpoint to Staff/Admin (AC-18).
    expect(fetchSpy).toHaveBeenCalledWith(expect.objectContaining({ owner: "all" }));
  });

  it("filters by owner via the Owner select", async () => {
    const fetchSpy = vi.spyOn(staffQueueApi, "fetchStaffTickets").mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 1 },
    });

    renderPage();
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());

    fireEvent.change(screen.getByDisplayValue("All Owners"), { target: { value: "mine" } });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(expect.objectContaining({ owner: "mine" }));
    });
  });
});
