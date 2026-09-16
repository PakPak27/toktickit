import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import UserManagement from "../../src/pages/UserManagement.js";
import { AuthProvider } from "../../src/context/AuthContext.js";
import * as adminUsersApi from "../../src/api/adminUsers.js";
import * as authApi from "../../src/api/auth.js";

function renderPage() {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <UserManagement />
      </AuthProvider>
    </BrowserRouter>
  );
}

const sampleUsers: adminUsersApi.AdminUserDto[] = [
  { id: 1, name: "Amanda Clark", email: "amanda.clark@toktickit.com", role: "ADMINISTRATOR", isActive: true },
  { id: 2, name: "Kevin Patel", email: "kevin.patel@toktickit.com", role: "IT_STAFF", isActive: true },
];

describe("UserManagement (UI-08)", () => {
  beforeEach(() => {
    vi.spyOn(authApi, "fetchCurrentUser").mockResolvedValue({
      id: 1, name: "Amanda Clark", email: "amanda.clark@toktickit.com", role: "ADMINISTRATOR", mustChangePassword: false,
    });
    vi.spyOn(adminUsersApi, "fetchUsers").mockResolvedValue(sampleUsers);
  });

  it("shows a duplicate-email inline field error instead of a page banner (AC-15)", async () => {
    vi.spyOn(adminUsersApi, "createUser").mockRejectedValue(new adminUsersApi.ConflictError("This email is already in use", "email"));

    renderPage();
    await waitFor(() => expect(screen.getByText("Amanda Clark")).toBeInTheDocument());

    fireEvent.click(screen.getByText("+ Create User"));
    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: "New User" } });
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: "amanda.clark@toktickit.com" } });
    fireEvent.click(screen.getByText("Save User"));

    await waitFor(() => {
      expect(screen.getByText("This email is already in use")).toBeInTheDocument();
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("prevents deactivating your own account via a disabled toggle (BR-32)", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Amanda Clark")).toBeInTheDocument());

    fireEvent.click(screen.getAllByText("Edit")[0]); // Amanda Clark row — the current user
    expect(await screen.findByLabelText("Active")).toBeDisabled();
    expect(screen.getByText(/You cannot deactivate your own account/i)).toBeInTheDocument();
  });

  it("shows a self-deactivation/last-admin conflict inline under Active, not a request loop", async () => {
    vi.spyOn(adminUsersApi, "updateUser").mockRejectedValue(
      new adminUsersApi.ConflictError("Cannot remove the last active Administrator")
    );

    renderPage();
    await waitFor(() => expect(screen.getByText("Kevin Patel")).toBeInTheDocument());

    fireEvent.click(screen.getAllByText("Edit")[1]); // Kevin Patel — not the current user, toggle enabled
    const toggle = await screen.findByLabelText("Active");
    expect(toggle).not.toBeDisabled();
    fireEvent.click(toggle);
    fireEvent.click(screen.getByText("Save User"));

    await waitFor(() => {
      expect(screen.getByText("Cannot remove the last active Administrator")).toBeInTheDocument();
    });
  });

  it("filters the list by role via the role select", async () => {
    const fetchSpy = vi.spyOn(adminUsersApi, "fetchUsers").mockResolvedValue(sampleUsers);
    renderPage();
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());

    fireEvent.change(screen.getByDisplayValue("All Roles"), { target: { value: "IT_STAFF" } });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(expect.objectContaining({ role: "IT_STAFF" }));
    });
  });
});
