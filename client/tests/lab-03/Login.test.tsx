import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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
});
