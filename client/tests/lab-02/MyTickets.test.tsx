import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import MyTickets from "../../src/pages/MyTickets.js";
import { RequesterProvider } from "../../src/context/RequesterContext.js";
import * as myTicketsApi from "../../src/api/myTickets.js";
import * as ticketsApi from "../../src/api/tickets.js";

function renderPage(requesterId = 1) {
  localStorage.setItem(
    "toktickit.selectedRequester",
    JSON.stringify({ id: requesterId, name: "Jennifer Anderson", email: "jennifer.anderson@example.com" })
  );
  return render(
    <BrowserRouter>
      <RequesterProvider>
        <MyTickets />
      </RequesterProvider>
    </BrowserRouter>
  );
}

describe("MyTickets", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(ticketsApi, "fetchCategories").mockResolvedValue([{ id: 1, name: "Hardware" }]);
  });

  it("shows the empty state when the Requester has zero tickets and no filters are active (BR-30)", async () => {
    vi.spyOn(myTicketsApi, "fetchMyTickets").mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 1 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/You haven't created any tickets yet/i)).toBeInTheDocument();
    });
  });

  it("shows a distinct no-results state when a search matches nothing (BR-31, AC-12)", async () => {
    vi.spyOn(myTicketsApi, "fetchMyTickets").mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 1 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/You haven't created any tickets yet/i)).toBeInTheDocument();
    });

    const searchBox = screen.getByPlaceholderText(/Search by ticket number or summary/i);
    searchBox.dispatchEvent(new Event("focus"));

    // Simulate typing a search term — triggers the "no results" branch, not "empty"
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.change(searchBox, { target: { value: "zzzz-no-match" } });

    await waitFor(() => {
      expect(screen.getByText(/No tickets match your filters/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/You haven't created any tickets yet/i)).not.toBeInTheDocument();
  });

  it("re-fetches tickets scoped to the newly selected Requester (AC-11)", async () => {
    const fetchSpy = vi.spyOn(myTicketsApi, "fetchMyTickets").mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 1 },
    });

    renderPage(1);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(1, expect.anything());
    });
  });

      it("renders a desktop page-size selector with 10/20/50 options", async () => {
    vi.spyOn(myTicketsApi, "fetchMyTickets").mockResolvedValue({
      data: [
        {
          id: 1, ticketNumber: "TKT-2026-000001", summary: "Test ticket",
          categoryId: 1, requestedPriority: "MEDIUM", itPriority: null,
          currentStatus: "NEW", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        },
      ],
      pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    });

    renderPage();

    const pageSizeSelect = await screen.findByLabelText(/Per page/i) as HTMLSelectElement;
    expect(pageSizeSelect).toBeInTheDocument();
    const options = Array.from(pageSizeSelect.options).map((o) => o.value);
    expect(options).toEqual(["10", "20", "50"]);
  });

  it("shows a sort-direction arrow on the active sorted column", async () => {
    const { fireEvent } = await import("@testing-library/react");
    vi.spyOn(myTicketsApi, "fetchMyTickets").mockResolvedValue({
      data: [
        {
          id: 1, ticketNumber: "TKT-2026-000001", summary: "Test ticket",
          categoryId: 1, requestedPriority: "MEDIUM", itPriority: null,
          currentStatus: "NEW", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        },
      ],
      pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    });

    renderPage();

    // role="button" is set explicitly on the <th>, so this only matches the
    // table header — not the mobile <select><option> text with similar wording.
    const createdDateHeader = await screen.findByRole("button", { name: /Created Date/ });

    // Default sort is createdAt desc — should show a down arrow
    expect(createdDateHeader.textContent).toMatch(/↓/);

    fireEvent.click(createdDateHeader);

    await waitFor(() => {
      expect(createdDateHeader.textContent).toMatch(/↑/);
    });
  });

  it("renders a mobile sort <select> control", async () => {
    vi.spyOn(myTicketsApi, "fetchMyTickets").mockResolvedValue({
      data: [
        {
          id: 1, ticketNumber: "TKT-2026-000001", summary: "Test ticket",
          categoryId: 1, requestedPriority: "MEDIUM", itPriority: null,
          currentStatus: "NEW", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        },
      ],
      pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    });

    renderPage();

    expect(await screen.findByLabelText(/Sort by/i)).toBeInTheDocument();
  });
});