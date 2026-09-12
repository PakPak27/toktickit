import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Login from "../../src/pages/Login.js";
import { AuthProvider } from "../../src/context/AuthContext.js";
import * as authApi from "../../src/api/auth.js";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <AuthProvider>
        <Login />
      </AuthProvider>
    </MemoryRouter>
  );
}

// Renders Login alongside real destination routes, so the post-login
// redirect target can actually be observed (not just that `login` resolved).
function renderWithDestinations() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/change-password" element={<div>Change Password Screen</div>} />
          <Route path="/tickets" element={<div>My Tickets Screen</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("Login (AC-01, AC-02)", () => {
  beforeEach(() => {
    vi.spyOn(authApi, "fetchCurrentUser").mockResolvedValue(null);
  });

  it("shows field-level errors and does not call the API when submitted empty", async () => {
    const loginSpy = vi.spyOn(authApi, "login");
    renderPage();

    await waitFor(() => screen.getByRole("button", { name: /sign in/i }));
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("Email is required")).toBeInTheDocument();
    expect(screen.getByText("Password is required")).toBeInTheDocument();
    expect(loginSpy).not.toHaveBeenCalled();
  });

  it("shows a single generic error banner on invalid credentials (AC-02)", async () => {
    vi.spyOn(authApi, "login").mockRejectedValue(new Error("Invalid email or password"));
    renderPage();

    await waitFor(() => screen.getByLabelText(/email address/i));
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
  });

  it("shows a busy state while the login request is in flight", async () => {
    let resolveLogin: () => void = () => {};
    vi.spyOn(authApi, "login").mockReturnValue(
      new Promise((resolve) => {
        resolveLogin = () => resolve(undefined as never);
      })
    );
    renderPage();

    await waitFor(() => screen.getByLabelText(/email address/i));
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "Password1!" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("button", { name: /signing in/i })).toBeDisabled();
    resolveLogin();
  });

  // Regression test for the PR #36 review finding: Login must never land a
  // mustChangePassword user on /tickets, even for an instant.
  it("routes a mustChangePassword user to Change Password, not My Tickets (AC-03)", async () => {
    vi.spyOn(authApi, "login").mockResolvedValue({
      id: 1,
      name: "Jennifer Anderson",
      email: "jennifer.anderson@example.com",
      role: "REQUESTER",
      mustChangePassword: true,
    });
    renderWithDestinations();

    await waitFor(() => screen.getByLabelText(/email address/i));
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "ChangeMe123!" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("Change Password Screen")).toBeInTheDocument();
    expect(screen.queryByText("My Tickets Screen")).not.toBeInTheDocument();
  });

  it("routes a user who already changed their password to My Tickets (AC-01)", async () => {
    vi.spyOn(authApi, "login").mockResolvedValue({
      id: 1,
      name: "Jennifer Anderson",
      email: "jennifer.anderson@example.com",
      role: "REQUESTER",
      mustChangePassword: false,
    });
    renderWithDestinations();

    await waitFor(() => screen.getByLabelText(/email address/i));
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "N3wSecret!Pass" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("My Tickets Screen")).toBeInTheDocument();
    expect(screen.queryByText("Change Password Screen")).not.toBeInTheDocument();
  });
});
