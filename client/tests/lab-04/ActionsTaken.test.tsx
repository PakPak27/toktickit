import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import StaffTicketDetail from "../../src/pages/StaffTicketDetail.js";
import TicketDetail from "../../src/pages/TicketDetail.js";
import { AuthProvider } from "../../src/context/AuthContext.js";
import * as staffTicketDetailApi from "../../src/api/staffTicketDetail.js";
import * as ticketDetailApi from "../../src/api/ticketDetail.js";
import * as commentsApi from "../../src/api/comments.js";
import * as authApi from "../../src/api/auth.js";
import * as actionsTakenApi from "../../src/api/actionsTaken.js";
import { StaleActionError, ActionTakenDto } from "../../src/api/actionsTaken.js";

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

function renderRequesterPage(ticketId = "1") {
  return render(
    <MemoryRouter initialEntries={[`/tickets/${ticketId}`]}>
      <Routes>
        <Route path="/tickets/:id" element={<TicketDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

const baseStaffTicket = {
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

const baseRequesterTicket = {
  id: 1,
  ticketNumber: "TKT-2026-000001",
  requesterId: 1,
  category: { id: 1, name: "Hardware" },
  relatedSystem: { id: 1, name: "VPN" },
  summary: "Test ticket summary",
  description: "Test ticket description",
  requestedPriority: "MEDIUM" as const,
  itPriority: null,
  currentStatus: "NEW",
  requesterConfirmedResolved: false,
  requesterConfirmedResolvedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  attachments: [],
};

function makeAction(overrides: Partial<ActionTakenDto> = {}): ActionTakenDto {
  return {
    id: 1,
    ticketId: 1,
    performedById: 5,
    performedByName: "Michael Brown",
    description: "Checked the account lockout status.",
    result: "Account was not locked.",
    followUpRequired: false,
    followUpNote: null,
    attachmentNotes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("Actions Taken — IT Staff Ticket Detail", () => {
  beforeEach(() => {
    vi.spyOn(authApi, "fetchCurrentUser").mockResolvedValue({
      id: 5, name: "Michael Brown", email: "michael.brown@toktickit.com", role: "IT_STAFF", mustChangePassword: false,
    });
    vi.spyOn(staffTicketDetailApi, "fetchAssignableUsers").mockResolvedValue([]);
    vi.spyOn(commentsApi, "fetchComments").mockResolvedValue([]);
    vi.spyOn(staffTicketDetailApi, "fetchStaffTicketDetail").mockResolvedValue(baseStaffTicket);
  });

  // UI-01: empty and populated states, follow-up badge
  it("shows the empty state, then a populated list with a Follow-up needed badge (UI-01)", async () => {
    vi.spyOn(actionsTakenApi, "fetchStaffActionsTaken").mockResolvedValue([]);
    renderStaffPage();

    fireEvent.click(await screen.findByText(/Actions Taken \(0\)/i));
    expect(await screen.findByText("No actions recorded yet.")).toBeInTheDocument();
  });

  it("renders a populated list with the Follow-up needed badge on the right entry (UI-01)", async () => {
    vi.spyOn(actionsTakenApi, "fetchStaffActionsTaken").mockResolvedValue([
      makeAction({ id: 1, description: "No follow-up needed here.", followUpRequired: false }),
      makeAction({ id: 2, description: "Escalated to the network team.", followUpRequired: true, followUpNote: "Check again tomorrow." }),
    ]);
    renderStaffPage();

    fireEvent.click(await screen.findByText(/Actions Taken \(2\)/i));
    expect(await screen.findByText("Escalated to the network team.")).toBeInTheDocument();
    expect(screen.getByText("Follow-up needed")).toBeInTheDocument();
    expect(screen.getByText("Check again tomorrow.")).toBeInTheDocument();
  });

  // UI-02 / AC-03: the Follow-up Note field appears and is required only when the checkbox is checked
  it("requires a Follow-up Note only once Follow-Up Required is checked (UI-02)", async () => {
    vi.spyOn(actionsTakenApi, "fetchStaffActionsTaken").mockResolvedValue([]);
    const createSpy = vi.spyOn(actionsTakenApi, "createActionTaken").mockRejectedValue(new Error("should not be called"));
    renderStaffPage();

    fireEvent.click(await screen.findByText(/Actions Taken \(0\)/i));
    fireEvent.click(await screen.findByText("Add Action Taken"));

    expect(screen.queryByLabelText("Follow-up Note")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Escalated to the network team." } });
    fireEvent.change(screen.getByLabelText("Result"), { target: { value: "Awaiting their response." } });
    fireEvent.click(screen.getByLabelText("Follow-Up Required"));

    expect(screen.getByLabelText("Follow-up Note")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add Action Taken" }));
    expect(await screen.findByText(/follow-up note is required/i)).toBeInTheDocument();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("creates an Action Taken and shows it in the list immediately (AC-01)", async () => {
    vi.spyOn(actionsTakenApi, "fetchStaffActionsTaken").mockResolvedValue([]);
    vi.spyOn(actionsTakenApi, "createActionTaken").mockResolvedValue(
      makeAction({ id: 9, description: "Replaced the cable.", result: "Connection restored." })
    );
    renderStaffPage();

    fireEvent.click(await screen.findByText(/Actions Taken \(0\)/i));
    fireEvent.click(await screen.findByText("Add Action Taken"));
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Replaced the cable." } });
    fireEvent.change(screen.getByLabelText("Result"), { target: { value: "Connection restored." } });
    fireEvent.click(screen.getByRole("button", { name: "Add Action Taken" }));

    // Querying and asserting inside the same waitFor callback (rather than
    // awaiting findByText and asserting on the resolved node separately)
    // avoids a race where a later re-render replaces the matched node
    // between resolution and the assertion.
    await waitFor(() => {
      expect(screen.getByText("Replaced the cable.")).toBeInTheDocument();
      expect(screen.getByText(/Actions Taken \(1\)/i)).toBeInTheDocument();
    });
  });

  // UI-03 / AC-07: a 409 shows the conflict banner and Reload loads the current record
  it("shows a conflict banner on a stale edit and loads the current record on Reload (UI-03)", async () => {
    const original = makeAction({ id: 3, description: "Original description.", result: "Original result." });
    vi.spyOn(actionsTakenApi, "fetchStaffActionsTaken").mockResolvedValue([original]);
    const current = makeAction({
      id: 3,
      description: "Changed by someone else.",
      result: "Changed result.",
      updatedAt: new Date(Date.now() + 1000).toISOString(),
    });
    vi.spyOn(actionsTakenApi, "updateActionTaken").mockRejectedValue(new StaleActionError(current));
    renderStaffPage();

    fireEvent.click(await screen.findByText(/Actions Taken \(1\)/i));
    fireEvent.click(await screen.findByText("Edit"));

    const descriptionField = screen.getByLabelText("Description") as HTMLTextAreaElement;
    fireEvent.change(descriptionField, { target: { value: "My local edit." } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByText(/changed since you opened it/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Reload"));

    await waitFor(() => {
      expect((screen.getByLabelText("Description") as HTMLTextAreaElement).value).toBe("Changed by someone else.");
    });
    expect(screen.queryByText(/changed since you opened it/i)).not.toBeInTheDocument();
  });

  // Review of PR #55: Save -> row updated in place, form closes.
  it("saves a successful edit, updating the row in place and closing the form", async () => {
    const original = makeAction({ id: 4, description: "Original description.", result: "Original result." });
    vi.spyOn(actionsTakenApi, "fetchStaffActionsTaken").mockResolvedValue([original]);
    vi.spyOn(actionsTakenApi, "updateActionTaken").mockResolvedValue(
      makeAction({ id: 4, description: "Edited description.", result: "Original result." })
    );
    renderStaffPage();

    fireEvent.click(await screen.findByText(/Actions Taken \(1\)/i));
    fireEvent.click(await screen.findByText("Edit"));
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Edited description." } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByText("Edited description.")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });

  // Review of PR #55: clearing Attachment Notes on edit must actually clear
  // it server-side, not be dropped by a `|| undefined` on an empty string.
  it("sends an emptied Attachment Notes field as an empty string, not undefined", async () => {
    const original = makeAction({ id: 5, attachmentNotes: "See photo.jpg" });
    vi.spyOn(actionsTakenApi, "fetchStaffActionsTaken").mockResolvedValue([original]);
    const updateSpy = vi
      .spyOn(actionsTakenApi, "updateActionTaken")
      .mockResolvedValue(makeAction({ id: 5, attachmentNotes: null }));
    renderStaffPage();

    fireEvent.click(await screen.findByText(/Actions Taken \(1\)/i));
    fireEvent.click(await screen.findByText("Edit"));
    fireEvent.change(screen.getByLabelText("Attachment Notes"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        1,
        5,
        expect.objectContaining({ attachmentNotes: "" })
      );
    });
  });
});

describe("Actions Taken — Requester Ticket Detail (read-only, UI-04)", () => {
  beforeEach(() => {
    vi.spyOn(commentsApi, "fetchComments").mockResolvedValue([]);
    vi.spyOn(ticketDetailApi, "fetchTicketDetail").mockResolvedValue(baseRequesterTicket);
  });

  it("shows the Actions Taken list read-only with no Add or Edit controls (AC-08)", async () => {
    vi.spyOn(actionsTakenApi, "fetchRequesterActionsTaken").mockResolvedValue([
      makeAction({ id: 1, description: "Checked the account.", followUpRequired: true, followUpNote: "Monitoring overnight." }),
    ]);
    renderRequesterPage();

    expect(await screen.findByText("Checked the account.")).toBeInTheDocument();
    expect(screen.getByText("Follow-up needed")).toBeInTheDocument();
    expect(screen.queryByText("Add Action Taken")).not.toBeInTheDocument();
    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
  });

  it("shows the empty state when there are no Actions Taken", async () => {
    vi.spyOn(actionsTakenApi, "fetchRequesterActionsTaken").mockResolvedValue([]);
    renderRequesterPage();

    expect(await screen.findByText("No actions recorded yet.")).toBeInTheDocument();
  });
});
