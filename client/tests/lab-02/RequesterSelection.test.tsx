import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import RequesterSelection from "../../src/pages/RequesterSelection.js";
import { RequesterProvider } from "../../src/context/RequesterContext.js";
import * as requestersApi from "../../src/api/requesters.js";

function renderPage() {
  return render(
    <BrowserRouter>
      <RequesterProvider>
        <RequesterSelection />
      </RequesterProvider>
    </BrowserRouter>
  );
}

describe("RequesterSelection", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("loads active requesters into the dropdown", async () => {
    vi.spyOn(requestersApi, "fetchActiveRequesters").mockResolvedValue([
      { id: 1, name: "Jennifer Anderson", email: "jennifer.anderson@example.com" },
      { id: 2, name: "Michael Brown", email: "michael.brown@example.com" },
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Jennifer Anderson")).toBeInTheDocument();
    });
    expect(screen.getByText("Michael Brown")).toBeInTheDocument();
  });

  it("shows a safe error state when the API fails", async () => {
    vi.spyOn(requestersApi, "fetchActiveRequesters").mockRejectedValue(
      new Error("network down")
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Unable to load development requesters/i)).toBeInTheDocument();
    });
  });

  it("disables Continue until a requester is selected", async () => {
    vi.spyOn(requestersApi, "fetchActiveRequesters").mockResolvedValue([
      { id: 1, name: "Jennifer Anderson", email: "jennifer.anderson@example.com" },
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Jennifer Anderson")).toBeInTheDocument();
    });

    const continueButton = screen.getByText("Continue →");
    expect(continueButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Development Requester/i), {
      target: { value: "1" },
    });

    expect(continueButton).not.toBeDisabled();
  });
});