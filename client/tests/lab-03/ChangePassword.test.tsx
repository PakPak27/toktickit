import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ChangePassword from "../../src/pages/ChangePassword.js";
import { AuthProvider } from "../../src/context/AuthContext.js";
import * as authApi from "../../src/api/auth.js";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/change-password"]}>
      <AuthProvider>
        <ChangePassword />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("ChangePassword (BR-07, AC-03)", () => {
  beforeEach(() => {
    vi.spyOn(authApi, "fetchCurrentUser").mockResolvedValue({
      id: 1,
      name: "Jennifer Anderson",
      email: "jennifer.anderson@example.com",
      role: "REQUESTER",
      mustChangePassword: true,
    });
  });

  it("keeps Continue disabled until every rule passes and the confirmation matches", async () => {
    renderPage();
    await waitFor(() => screen.getByLabelText(/current \(temporary\) password/i));

    const continueBtn = screen.getByRole("button", { name: /continue/i });
    expect(continueBtn).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/current \(temporary\) password/i), {
      target: { value: "ChangeMe123!" },
    });
    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: "weak" } });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: "weak" } });
    expect(continueBtn).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: "N3wSecret!Pass" } });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: "N3wSecret!Pass" } });
    expect(continueBtn).not.toBeDisabled();
  });

  it("flips each rule indicator to satisfied as the new password is typed", async () => {
    renderPage();
    await waitFor(() => screen.getByLabelText(/^new password$/i));

    expect(screen.getByText(/at least 8 characters/i)).toHaveTextContent("○");
    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: "N3wSecret!Pass" } });
    expect(screen.getByText(/at least 8 characters/i)).toHaveTextContent("✓");
  });

  it("shows a safe error and clears the current-password field on a wrong current password", async () => {
    vi.spyOn(authApi, "changePassword").mockRejectedValue(new Error("Current password is incorrect"));
    renderPage();
    await waitFor(() => screen.getByLabelText(/current \(temporary\) password/i));

    fireEvent.change(screen.getByLabelText(/current \(temporary\) password/i), {
      target: { value: "wrong-temp-password" },
    });
    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: "N3wSecret!Pass" } });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: "N3wSecret!Pass" } });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Current password is incorrect");
    expect((screen.getByLabelText(/current \(temporary\) password/i) as HTMLInputElement).value).toBe("");
  });
});
