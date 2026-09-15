import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";

interface Rule {
  label: string;
  test: (password: string) => boolean;
}

// Mirrors server/src/auth.ts passwordRuleFailures (BR-07).
const RULES: Rule[] = [
  { label: "At least 8 characters", test: (p) => p.length >= 8 },
  { label: "Include upper and lower case letters", test: (p) => /[a-z]/.test(p) && /[A-Z]/.test(p) },
  { label: "Include a number and a special character", test: (p) => /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p) },
];

export default function ChangePassword() {
  const { user, changePassword } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!user.mustChangePassword) {
    return <Navigate to="/tickets" replace />;
  }

  const rulesPass = RULES.every((rule) => rule.test(newPassword));
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit = currentPassword.length > 0 && rulesPass && passwordsMatch;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);
    try {
      await changePassword(currentPassword, newPassword);
      navigate("/tickets");
    } catch (err) {
      setError((err as Error).message);
      setCurrentPassword("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container py-5" style={{ maxWidth: 460 }}>
      <div className="card shadow-sm border-0 p-4">
        <h1 className="h4 mb-1" style={{ color: "#006B3C" }}>
          Change Your Password
        </h1>
        <p className="text-muted small mb-4">You must change your password to continue.</p>

        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-3">
            <label htmlFor="currentPassword" className="form-label fw-semibold">
              Current (temporary) password
            </label>
            <input
              id="currentPassword"
              type="password"
              className="form-control"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={submitting}
              autoComplete="current-password"
            />
          </div>

          <div className="mb-3">
            <label htmlFor="newPassword" className="form-label fw-semibold">
              New password
            </label>
            <input
              id="newPassword"
              type="password"
              className="form-control"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={submitting}
              autoComplete="new-password"
            />
          </div>

          <div className="mb-3">
            <label htmlFor="confirmPassword" className="form-label fw-semibold">
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              type="password"
              className={`form-control${confirmPassword.length > 0 && !passwordsMatch ? " is-invalid" : ""}`}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={submitting}
              autoComplete="new-password"
            />
            {confirmPassword.length > 0 && !passwordsMatch && (
              <div className="invalid-feedback">Passwords do not match</div>
            )}
          </div>

          <div className="mb-4 p-3" style={{ background: "#EAF6EF", borderRadius: 4 }}>
            <p className="fw-semibold small mb-2">Password must:</p>
            <ul className="list-unstyled mb-0 small">
              {RULES.map((rule) => {
                const ok = rule.test(newPassword);
                return (
                  <li key={rule.label} style={{ color: ok ? "#0B7A46" : "#495057" }}>
                    {ok ? "✓" : "○"} {rule.label}
                  </li>
                );
              })}
            </ul>
          </div>

          <button type="submit" className="btn btn-success w-100" disabled={!canSubmit || submitting}>
            {submitting ? "Saving…" : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
