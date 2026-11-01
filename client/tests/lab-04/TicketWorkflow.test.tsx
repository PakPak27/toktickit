import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import StaffTicketDetail from "../../src/pages/StaffTicketDetail.js";
import { AuthProvider } from "../../src/context/AuthContext.js";
import * as staffTicketDetailApi from "../../src/api/staffTicketDetail.js";
import { ResolutionBlockedError, StaleTicketError } from "../../src/api/staffTicketDetail.js";
import * as commentsApi from "../../src/api/comments.js";
import * as authApi from "../../src/api/auth.js";
import * as actionsTakenApi from "../../src/api/actionsTaken.js";
import { ActionTakenDto } from "../../src/api/actionsTaken.js";

function renderStaffPage(ticketId = "1") {
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
  currentStatus: "WAITING_FOR_REQUESTER",
  validNextStatuses: ["OPEN", "IN_PROGRESS", "RESOLVED", "CANCELLED"],
  ticketOwner: { id: 5, name: "Michael Brown" },
  requesterConfirmedResolved: false,
  requesterConfirmedResolvedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  attachments: [],
  internalNotes: [],
};

function makeAction(overrides: Partial<ActionTakenDto> = {}): ActionTakenDto {
  return {
    id: 1,
    ticketId: 1,
    performedById: 5,
    performedByName: "Michael Brown",
    description: "Checked the account.",
    result: "Account was not locked.",
    followUpRequired: false,
    followUpNote: null,
    attachmentNotes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("Status select — resolution-gate hint (UI-05)", () => {
  beforeEach(() => {
    vi.spyOn(authApi, "fetchCurrentUser").mockResolvedValue({
      id: 5, name: "Michael Brown", email: "michael.brown@toktickit.com", role: "IT_STAFF", mustChangePassword: false,
    });
    vi.spyOn(staffTicketDetailApi, "fetchAssignableUsers").mockResolvedValue([]);
    vi.spyOn(commentsApi, "fetchComments").mockResolvedValue([]);
    vi.spyOn(staffTicketDetailApi, "fetchStaffTicketDetail").mockResolvedValue(baseTicket);
  });

  it("omits RESOLVED when there are zero Actions Taken", async () => {
    vi.spyOn(actionsTakenApi, "fetchStaffActionsTaken").mockResolvedValue([]);
    renderStaffPage();

    const statusSelect = (await screen.findByLabelText(/Current Status/i)) as HTMLSelectElement;
    await waitFor(() => {
      const options = Array.from(statusSelect.options).map((o) => o.value).filter(Boolean);
      expect(options).not.toContain("RESOLVED");
    });
  });

  it("omits RESOLVED while any Action Taken has an open follow-up", async () => {
    vi.spyOn(actionsTakenApi, "fetchStaffActionsTaken").mockResolvedValue([
      makeAction({ followUpRequired: true, followUpNote: "Call back tomorrow." }),
    ]);
    renderStaffPage();

    const statusSelect = (await screen.findByLabelText(/Current Status/i)) as HTMLSelectElement;
    await waitFor(() => {
      const options = Array.from(statusSelect.options).map((o) => o.value).filter(Boolean);
      expect(options).not.toContain("RESOLVED");
    });
  });

  it("offers RESOLVED once at least one Action Taken exists with no open follow-up", async () => {
    vi.spyOn(actionsTakenApi, "fetchStaffActionsTaken").mockResolvedValue([makeAction({ followUpRequired: false })]);
    renderStaffPage();

    const statusSelect = (await screen.findByLabelText(/Current Status/i)) as HTMLSelectElement;
    await waitFor(() => {
      const options = Array.from(statusSelect.options).map((o) => o.value).filter(Boolean);
      expect(options).toContain("RESOLVED");
    });
  });

  it("shows the blocking Actions and jumps to the Actions Taken tab on a stale RESOLUTION_BLOCKED response", async () => {
    vi.spyOn(actionsTakenApi, "fetchStaffActionsTaken").mockResolvedValue([makeAction({ followUpRequired: false })]);
    vi.spyOn(staffTicketDetailApi, "updateStatus").mockRejectedValue(
      new ResolutionBlockedError("This ticket has an open follow-up on at least one Action Taken", [
        { id: 9, description: "Escalated to the vendor." },
      ])
    );
    renderStaffPage();

    const statusSelect = (await screen.findByLabelText(/Current Status/i)) as HTMLSelectElement;
    // The Actions Taken fetch is a separate effect from the ticket load, so
    // RESOLVED may not be an option yet at the moment the label/select
    // first appear — wait for it before selecting it, or the native
    // <select> silently ignores the out-of-range value.
    await waitFor(() => {
      expect(Array.from(statusSelect.options).some((o) => o.value === "RESOLVED")).toBe(true);
    });
    fireEvent.change(statusSelect, { target: { value: "RESOLVED" } });

    await waitFor(() => {
      expect(screen.getByText(/Escalated to the vendor\./i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Actions Taken/i })).toHaveClass("active");
  });

  it("reloads and shows a message on a stale status change (BR-14)", async () => {
    vi.spyOn(actionsTakenApi, "fetchStaffActionsTaken").mockResolvedValue([]);
    const fetchSpy = vi
      .spyOn(staffTicketDetailApi, "fetchStaffTicketDetail")
      .mockResolvedValueOnce(baseTicket)
      .mockResolvedValueOnce({ ...baseTicket, currentStatus: "OPEN", validNextStatuses: ["IN_PROGRESS", "CANCELLED"] });
    vi.spyOn(staffTicketDetailApi, "updateStatus").mockRejectedValue(
      new StaleTicketError("This ticket changed since you opened it")
    );
    renderStaffPage();

    const statusSelect = (await screen.findByLabelText(/Current Status/i)) as HTMLSelectElement;
    fireEvent.change(statusSelect, { target: { value: "CANCELLED" } });

    await waitFor(() => {
      expect(screen.getByText(/changed since you opened it/i)).toBeInTheDocument();
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
