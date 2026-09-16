import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import StaffTicketDetail from "../../src/pages/StaffTicketDetail.js";
import { AuthProvider } from "../../src/context/AuthContext.js";
import * as staffTicketDetailApi from "../../src/api/staffTicketDetail.js";
import * as commentsApi from "../../src/api/comments.js";
import * as authApi from "../../src/api/auth.js";

function renderPage(ticketId = "1") {
  return render(
    <MemoryRouter initialEntries={[`/staff/tickets/${ticketId}`]}>
      <AuthProvider>
        <Routes>
          <Route path="/staff/tickets/:id" element={<StaffTicketDetail />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

const baseTicket = {
  id: 1,
  ticketNumber: "TKT-2026-000001",
  requesterId: 1,
  requester: { id: 1, name: "Jennifer Anderson", email: "jennifer.anderson@example.com" },
  category: { id: 1, name: "Hardware" },
  relatedSystem: { id: 1, name: "VPN" },
  summary: "Test ticket summary",
  description: "Test ticket description",
  requestedPriority: "MEDIUM" as const,
  itPriority: null,
  currentStatus: "NEW",
  validNextStatuses: ["OPEN", "IN_PROGRESS", "CANCELLED"],
  ticketOwner: null,
  requesterConfirmedResolved: false,
  requesterConfirmedResolvedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  attachments: [],
  internalNotes: [],
};

describe("StaffTicketDetail", () => {
  beforeEach(() => {
    vi.spyOn(authApi, "fetchCurrentUser").mockResolvedValue({
      id: 5, name: "Michael Brown", email: "michael.brown@toktickit.com", role: "IT_STAFF", mustChangePassword: false,
    });
    vi.spyOn(staffTicketDetailApi, "fetchAssignableUsers").mockResolvedValue([
      { id: 5, name: "Michael Brown" },
      { id: 9, name: "Amanda Clark" },
    ]);
    vi.spyOn(commentsApi, "fetchComments").mockResolvedValue([]);
  });

  // UI-06 / AC-09: only matrix-valid next statuses appear as options
  it("only shows matrix-valid next statuses in the status dropdown", async () => {
    vi.spyOn(staffTicketDetailApi, "fetchStaffTicketDetail").mockResolvedValue(baseTicket);
    renderPage();

    const statusSelect = await screen.findByLabelText(/Current Status/i) as HTMLSelectElement;
    const options = Array.from(statusSelect.options).map((o) => o.value).filter(Boolean);
    expect(options).toEqual(["OPEN", "IN_PROGRESS", "CANCELLED"]);
    expect(options).not.toContain("RESOLVED");
  });

  // UI-05 / Sec. 7: Public Comments vs Internal Notes are visually distinct and switch content
  it("shows Public Comments and Internal Notes as separate tabs with distinct content", async () => {
    vi.spyOn(staffTicketDetailApi, "fetchStaffTicketDetail").mockResolvedValue({
      ...baseTicket,
      internalNotes: [
        { id: 1, ticketId: 1, authorId: 5, authorName: "Michael Brown", authorRole: "IT_STAFF" as const, content: "Escalated to vendor.", createdAt: new Date().toISOString() },
      ],
    });
    vi.spyOn(commentsApi, "fetchComments").mockResolvedValue([
      { id: 1, ticketId: 1, authorId: 1, authorName: "Jennifer Anderson", authorRole: "REQUESTER" as const, content: "Any update?", createdAt: new Date().toISOString() },
    ]);

    renderPage();

    await waitFor(() => expect(screen.getByText("Any update?")).toBeInTheDocument());
    expect(screen.queryByText("Escalated to vendor.")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Internal Notes, staff only/i }));

    await waitFor(() => expect(screen.getByText("Escalated to vendor.")).toBeInTheDocument());
    expect(screen.queryByText("Any update?")).not.toBeInTheDocument();
    expect(screen.getByText(/Internal — not visible to Requester/i)).toBeInTheDocument();
  });

  it("shows a Claim for me action when unassigned, and claims via the session user", async () => {
    vi.spyOn(staffTicketDetailApi, "fetchStaffTicketDetail").mockResolvedValue(baseTicket);
    const claimSpy = vi.spyOn(staffTicketDetailApi, "updateTicketOwner").mockResolvedValue({ ticketOwner: { id: 5, name: "Michael Brown" } });

    renderPage();

    const claimButton = await screen.findByText("Claim for me");
    fireEvent.click(claimButton);

    await waitFor(() => {
      expect(claimSpy).toHaveBeenCalledWith(1, 5);
    });
  });

  it("shows the appears-resolved badge in the header when the Requester confirmed", async () => {
    vi.spyOn(staffTicketDetailApi, "fetchStaffTicketDetail").mockResolvedValue({
      ...baseTicket,
      requesterConfirmedResolved: true,
      requesterConfirmedResolvedAt: new Date().toISOString(),
    });

    renderPage();

    expect(await screen.findByText(/Requester indicated this appears resolved on/i)).toBeInTheDocument();
  });
});
