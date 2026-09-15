import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";

// ui-spec.md §6/§8: a full-page "forbidden" state for a role reaching a
// route it isn't permitted to use client-side — hiding the nav link isn't
// authorization (the backend re-checks independently), this is just UX.
export default function RequireRole({ roles, children }: { roles: string[]; children: ReactNode }) {
  const { user } = useAuth();

  if (!user || !roles.includes(user.role)) {
    return (
      <div className="container py-5 text-center">
        <h1 className="h4 mb-3">You don't have access to this page</h1>
        <Link to="/" className="btn btn-success">
          Go to my home
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
