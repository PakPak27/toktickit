import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { RequesterProvider } from "../../src/context/RequesterContext.js";
import RequireRequester from "../../src/components/RequireRequester.js";

function renderGuarded(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <RequesterProvider>
        <Routes>
          <Route path="/" element={<div>Requester Selection Screen</div>} />
          <Route
            path="/tickets"
            element={
              <RequireRequester>
                <div>My Tickets Screen</div>
              </RequireRequester>
            }
          />
        </Routes>
      </RequesterProvider>
    </MemoryRouter>
  );
}

describe("RequireRequester (AC-02)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("redirects to the Requester Selection screen when no requester is selected", () => {
    renderGuarded("/tickets");

    expect(screen.getByText("Requester Selection Screen")).toBeInTheDocument();
    expect(screen.queryByText("My Tickets Screen")).not.toBeInTheDocument();
  });

  it("renders the protected screen when a requester is already selected", () => {
    localStorage.setItem(
      "toktickit.selectedRequester",
      JSON.stringify({ id: 1, name: "Jennifer Anderson", email: "jennifer.anderson@example.com" })
    );

    renderGuarded("/tickets");

    expect(screen.getByText("My Tickets Screen")).toBeInTheDocument();
    expect(screen.queryByText("Requester Selection Screen")).not.toBeInTheDocument();
  });
});