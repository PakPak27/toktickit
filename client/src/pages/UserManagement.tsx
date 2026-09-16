import { useEffect, useState } from "react";
import {
  fetchUsers,
  createUser,
  updateUser,
  resetPassword,
  AdminUserDto,
  Role,
  ConflictError,
} from "../api/adminUsers.js";
import { useAuth } from "../context/AuthContext.js";

type LoadState = "loading" | "success" | "error";

const ROLE_LABELS: Record<Role, string> = {
  REQUESTER: "Requester",
  IT_STAFF: "IT Staff",
  ADMINISTRATOR: "Administrator",
};

function generatePassword(): string {
  // Meets BR-07: 8+ chars, upper/lower/digit/special.
  const specials = "!@#$%";
  const rand = Math.random().toString(36).slice(2, 8);
  return `Aa1${specials[Math.floor(Math.random() * specials.length)]}${rand}`;
}

interface FormState {
  id: number | null;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  initialPassword: string;
}

const EMPTY_FORM: FormState = { id: null, name: "", email: "", role: "REQUESTER", isActive: true, initialPassword: "" };

export default function UserManagement() {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState<AdminUserDto[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "">("");

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const [resetPanelOpen, setResetPanelOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetting, setResetting] = useState(false);

  function loadUsers() {
    setLoadState("loading");
    fetchUsers({ search: search || undefined, role: roleFilter || undefined })
      .then((data) => {
        setUsers(data);
        setLoadState("success");
      })
      .catch(() => setLoadState("error"));
  }

  useEffect(loadUsers, [search, roleFilter]);

  function openCreate() {
    setForm({ ...EMPTY_FORM, initialPassword: generatePassword() });
    setFieldErrors({});
    setFormError("");
    setResetPanelOpen(false);
    setFormOpen(true);
  }

  function openEdit(u: AdminUserDto) {
    setForm({ id: u.id, name: u.name, email: u.email, role: u.role, isActive: u.isActive, initialPassword: "" });
    setFieldErrors({});
    setFormError("");
    setResetPanelOpen(false);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setResetPanelOpen(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFormError("");

    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = "Full Name is required";
    if (!form.email.trim()) errors.email = "Email Address is required";
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSaving(true);
    try {
      if (form.id === null) {
        await createUser({
          name: form.name.trim(),
          email: form.email.trim(),
          role: form.role,
          isActive: form.isActive,
          initialPassword: form.initialPassword,
        });
      } else {
        await updateUser(form.id, {
          name: form.name.trim(),
          email: form.email.trim(),
          role: form.role,
          isActive: form.isActive,
        });
      }
      setSuccessMessage(form.id === null ? "User created." : "User updated.");
      closeForm();
      loadUsers();
    } catch (err) {
      if (err instanceof ConflictError && err.field === "email") {
        setFieldErrors({ email: err.message });
      } else if (err instanceof ConflictError) {
        // BR-32/BR-33 safety-rule conflicts — surface under the Active toggle.
        setFieldErrors({ isActive: err.message });
      } else {
        setFormError(err instanceof Error ? err.message : "Unable to save user");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPassword() {
    if (form.id === null) return;
    setResetError("");
    setResetting(true);
    try {
      await resetPassword(form.id, newPassword);
      setSuccessMessage(`Password reset. ${form.name} must change it at next login.`);
      setResetPanelOpen(false);
      setNewPassword("");
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Unable to reset password");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <h1 className="h4 mb-0">Users</h1>
        <button className="btn btn-success btn-sm" onClick={openCreate}>
          + Create User
        </button>
      </div>

      {successMessage && (
        <div className="alert alert-success alert-dismissible" role="alert">
          {successMessage}
          <button type="button" className="btn-close" onClick={() => setSuccessMessage("")} aria-label="Dismiss" />
        </div>
      )}

      <div className="card border-0 shadow-sm p-3 mb-3">
        <div className="row g-2">
          <div className="col-md-6">
            <input
              type="text"
              className="form-control"
              placeholder="Search users by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="col-md-4">
            <select className="form-select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as Role | "")}>
              <option value="">All Roles</option>
              <option value="REQUESTER">Requester</option>
              <option value="IT_STAFF">IT Staff</option>
              <option value="ADMINISTRATOR">Administrator</option>
            </select>
          </div>
        </div>
      </div>

      {loadState === "loading" && <p className="text-muted">Loading…</p>}
      {loadState === "error" && (
        <div className="alert alert-danger">Unable to load users. Please try again later.</div>
      )}
      {loadState === "success" && users.length === 0 && (
        <div className="card border-0 shadow-sm p-5 text-center">
          <p className="mb-0">No users match your search.</p>
        </div>
      )}

      {loadState === "success" && users.length > 0 && (
        <div className="card border-0 shadow-sm">
          <table className="table mb-0">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td><span className="badge bg-secondary-subtle text-dark">{ROLE_LABELS[u.role]}</span></td>
                  <td>
                    <span className="badge" style={u.isActive ? { background: "#EAF6EF", color: "#0B7A46" } : { background: "#FBE3E1", color: "#B3261E" }}>
                      {u.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      aria-label="Edit user"
                      onClick={() => openEdit(u)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formOpen && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-start justify-content-end"
          style={{ background: "rgba(0,0,0,0.35)", zIndex: 1000 }}
        >
          <div className="bg-white shadow h-100 p-4" style={{ width: "min(420px, 100%)", overflowY: "auto" }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="h5 mb-0">{form.id === null ? "Create New User" : "Edit User"}</h2>
              <button className="btn-close" onClick={closeForm} aria-label="Close" />
            </div>

            {formError && <div className="alert alert-danger">{formError}</div>}

            <form onSubmit={handleSave}>
              <div className="mb-3">
                <label htmlFor="nameInput" className="form-label fw-semibold">
                  Full Name <span className="text-danger">*</span>
                </label>
                <input
                  id="nameInput"
                  type="text"
                  className="form-control"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
                {fieldErrors.name && <div className="text-danger small mt-1">{fieldErrors.name}</div>}
              </div>

              <div className="mb-3">
                <label htmlFor="emailInput" className="form-label fw-semibold">
                  Email Address <span className="text-danger">*</span>
                </label>
                <input
                  id="emailInput"
                  type="email"
                  className="form-control"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
                {fieldErrors.email && <div className="text-danger small mt-1">{fieldErrors.email}</div>}
              </div>

              <div className="mb-3">
                <label htmlFor="roleSelect" className="form-label fw-semibold">
                  Role <span className="text-danger">*</span>
                </label>
                <select
                  id="roleSelect"
                  className="form-select"
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
                >
                  <option value="REQUESTER">Requester</option>
                  <option value="IT_STAFF">IT Staff</option>
                  <option value="ADMINISTRATOR">Administrator</option>
                </select>
              </div>

              <div className="mb-3 form-check form-switch">
                <input
                  id="activeToggle"
                  type="checkbox"
                  className="form-check-input"
                  checked={form.isActive}
                  disabled={form.id === currentUser?.id}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                />
                <label htmlFor="activeToggle" className="form-check-label">
                  Active
                </label>
                {form.id === currentUser?.id && (
                  <div className="text-muted small">You cannot deactivate your own account.</div>
                )}
                {fieldErrors.isActive && <div className="text-danger small mt-1">{fieldErrors.isActive}</div>}
              </div>

              {form.id === null && (
                <div className="mb-3">
                  <label htmlFor="initialPasswordInput" className="form-label fw-semibold">
                    Initial Password
                  </label>
                  <div className="input-group">
                    <input
                      id="initialPasswordInput"
                      type="text"
                      className="form-control"
                      value={form.initialPassword}
                      onChange={(e) => setForm((f) => ({ ...f, initialPassword: e.target.value }))}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => setForm((f) => ({ ...f, initialPassword: generatePassword() }))}
                    >
                      Generate
                    </button>
                  </div>
                  <div className="text-muted small mt-1">The user must change this at their next login.</div>
                </div>
              )}

              <button type="submit" className="btn btn-success w-100" disabled={saving}>
                {saving ? "Saving…" : "Save User"}
              </button>
            </form>

            {form.id !== null && (
              <div className="mt-4 pt-3 border-top">
                {!resetPanelOpen ? (
                  <button className="btn btn-outline-secondary w-100" onClick={() => { setResetPanelOpen(true); setNewPassword(generatePassword()); setResetError(""); }}>
                    Set New Password
                  </button>
                ) : (
                  <div>
                    <p className="small text-muted">
                      This will require {form.name} to set a new password at their next login.
                    </p>
                    <div className="input-group mb-2">
                      <input
                        type="text"
                        className="form-control"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        aria-label="New password"
                      />
                      <button type="button" className="btn btn-outline-secondary" onClick={() => setNewPassword(generatePassword())}>
                        Generate
                      </button>
                    </div>
                    {resetError && <div className="text-danger small mb-2">{resetError}</div>}
                    <div className="d-flex gap-2">
                      <button className="btn btn-success flex-fill" onClick={handleResetPassword} disabled={resetting}>
                        {resetting ? "Saving…" : "Confirm"}
                      </button>
                      <button className="btn btn-outline-secondary" onClick={() => setResetPanelOpen(false)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
