import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";

export default function Login() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in — don't show the login form again.
  if (user) {
    return <Navigate to={user.mustChangePassword ? "/change-password" : "/tickets"} replace />;
  }

  const emailError = touched && !email.trim() ? "Email is required" : null;
  const passwordError = touched && !password ? "Password is required" : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!email.trim() || !password) return;

    setSubmitting(true);
    setError(null);
    try {
      // Don't navigate here — the `if (user)` guard above re-renders once
      // `login` resolves and routes to /change-password or /tickets based
      // on the freshly-loaded mustChangePassword, so there's exactly one
      // source of truth for where a signed-in user lands (AC-03).
      await login(email.trim(), password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container py-5" style={{ maxWidth: 420 }}>
      <div className="card shadow-sm border-0 p-4">
        <h1 className="h4 text-center mb-1" style={{ color: "#006B3C" }}>
          TokTickIT
        </h1>
        <p className="text-muted text-center small mb-4">Sign in to your account</p>

        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-3">
            <label htmlFor="email" className="form-label fw-semibold">
              Email address
            </label>
            <input
              id="email"
              type="email"
              className={`form-control${emailError ? " is-invalid" : ""}`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              autoComplete="username"
            />
            {emailError && <div className="invalid-feedback">{emailError}</div>}
          </div>

          <div className="mb-4">
            <label htmlFor="password" className="form-label fw-semibold">
              Password
            </label>
            <div className="input-group">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className={`form-control${passwordError ? " is-invalid" : ""}`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="btn btn-outline-secondary"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
              {passwordError && <div className="invalid-feedback">{passwordError}</div>}
            </div>
          </div>

          <button type="submit" className="btn btn-success w-100" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
