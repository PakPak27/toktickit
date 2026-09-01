import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useRequester } from "../context/RequesterContext.js";

export default function RequireRequester({ children }: { children: ReactNode }) {
  const { requester } = useRequester();
  if (!requester) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}