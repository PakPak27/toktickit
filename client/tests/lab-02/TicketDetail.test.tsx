import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import TicketDetail from "../../src/pages/TicketDetail.js";
import * as ticketDetailApi from "../../src/api/ticketDetail.js";
import * as commentsApi from "../../src/api/comments.js";

function renderPage(ticketId = "1") {
  return render(
    <MemoryRouter initialEntries={[`/tickets/${ticketId}`]}>
      <Routes>
        <Route path="/tickets/:id" element={<TicketDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

const baseTicket = {
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

describe("TicketDetail", () => {
  beforeEach(() => {
    vi.spyOn(commentsApi, "fetchComments").mockResolvedValue([]);
  });

  it("shows an access-denied message when the ticket belongs to another Requester (AC-05)", async () => {
    vi.spyOn(ticketDetailApi, "fetchTicketDetail").mockRejectedValue(
      new ticketDetailApi.AccessDeniedError("You do not have access to this ticket")
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/You do not have access to this ticket/i)).toBeInTheDocument();
    });
  });

  it("shows a not-found message for a nonexistent ticket", async () => {
    vi.spyOn(ticketDetailApi, "fetchTicketDetail").mockRejectedValue(
      new ticketDetailApi.NotFoundError("Ticket not found")
    );

    renderPage("999999");

    await waitFor(() => {
      expect(screen.getByText(/Ticket not found/i)).toBeInTheDocument();
    });
  });

  it("displays an active attachment with a Download and Remove control", async () => {
    vi.spyOn(ticketDetailApi, "fetchTicketDetail").mockResolvedValue({
      ...baseTicket,
      attachments: [
        {
          id: 10, fileName: "report.pdf", sizeBytes: 12345, mimeType: "application/pdf",
          uploadedAt: new Date().toISOString(), removedAt: null, removalReason: null,
        },
      ],
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("report.pdf")).toBeInTheDocument();
    });
    expect(screen.getByText("Download")).toBeInTheDocument();
    expect(screen.getByText("Remove")).toBeInTheDocument();
  });

  it("shows a removed attachment as blocked with its reason, and disables Download for it (AC-10)", async () => {
    vi.spyOn(ticketDetailApi, "fetchTicketDetail").mockResolvedValue({
      ...baseTicket,
      attachments: [
        {
          id: 11, fileName: "old-file.png", sizeBytes: 5000, mimeType: "image/png",
          uploadedAt: new Date().toISOString(),
          removedAt: new Date().toISOString(), removalReason: "Wrong file uploaded",
        },
      ],
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("old-file.png")).toBeInTheDocument();
    });
    expect(screen.getByText(/Wrong file uploaded/i)).toBeInTheDocument();
    // Removed attachments render in their own section without a Download button
    expect(screen.queryByText("Download")).not.toBeInTheDocument();
  });

  it("requires a reason before confirming attachment removal (BR-28)", async () => {
    vi.spyOn(ticketDetailApi, "fetchTicketDetail").mockResolvedValue({
      ...baseTicket,
      attachments: [
        {
          id: 12, fileName: "active-file.pdf", sizeBytes: 2000, mimeType: "application/pdf",
          uploadedAt: new Date().toISOString(), removedAt: null, removalReason: null,
        },
      ],
    });
    const removeSpy = vi.spyOn(ticketDetailApi, "removeAttachment");

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("active-file.pdf")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Remove"));
    fireEvent.click(screen.getByText("Confirm"));

    await waitFor(() => {
      expect(screen.getByText(/A removal reason of at least 3 characters is required/i)).toBeInTheDocument();
    });
    expect(removeSpy).not.toHaveBeenCalled();
  });

  // UI-04 / AC-11
  it("adds a Public Comment to the thread immediately after posting", async () => {
    vi.spyOn(ticketDetailApi, "fetchTicketDetail").mockResolvedValue(baseTicket);
    const postSpy = vi.spyOn(commentsApi, "postComment").mockResolvedValue({
      id: 1,
      ticketId: 1,
      authorId: 1,
      authorName: "Jennifer Anderson",
      authorRole: "REQUESTER",
      content: "Any update on this?",
      createdAt: new Date().toISOString(),
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("No comments yet.")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/Type your comment here/i), {
      target: { value: "Any update on this?" },
    });
    fireEvent.click(screen.getByText("Post Comment"));

    await waitFor(() => {
      expect(screen.getByText("Any update on this?")).toBeInTheDocument();
    });
    expect(postSpy).toHaveBeenCalledWith(1, "Any update on this?");
  });

  // AC-13
  it("shows the appears-resolved badge instead of the action button once confirmed", async () => {
    vi.spyOn(ticketDetailApi, "fetchTicketDetail").mockResolvedValue(baseTicket);
    vi.spyOn(commentsApi, "markAppearsResolved").mockResolvedValue({
      requesterConfirmedResolved: true,
      requesterConfirmedResolvedAt: new Date().toISOString(),
    });

    renderPage();

    const resolveButton = await screen.findByText("Problem Appears Resolved");
    fireEvent.click(resolveButton);

    await waitFor(() => {
      expect(screen.getByText(/You indicated this appears resolved on/i)).toBeInTheDocument();
    });
    expect(screen.queryByText("Problem Appears Resolved")).not.toBeInTheDocument();
  });
});
