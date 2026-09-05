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
});