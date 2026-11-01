import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.js";
import { useAuth } from "./context/AuthContext.js";
import RequireAuth from "./components/RequireAuth.js";
import RequireRole from "./components/RequireRole.js";
import AppShell from "./components/AppShell.js";
import CreateTicket from "./pages/CreateTicket.js";
import MyTickets from "./pages/MyTickets.js";
import TicketDetail from "./pages/TicketDetail.js";
import StaffTicketQueue from "./pages/StaffTicketQueue.js";
import StaffTicketDetail from "./pages/StaffTicketDetail.js";
import UserManagement from "./pages/UserManagement.js";
import RequesterDashboard from "./pages/RequesterDashboard.js";
import StaffDashboard from "./pages/StaffDashboard.js";
import Login from "./pages/Login.js";
import ChangePassword from "./pages/ChangePassword.js";

// ui-spec.md §1 — every role now lands on the Dashboard instead of their
// own list screen; My Tickets/Ticket Queue/Users remain reachable from nav.
function HomeRedirect() {
  return <Navigate to="/dashboard" replace />;
}

// One route, role-switched content — Requester and IT Staff/Administrator
// each see their own Dashboard, no separate per-role URL (ui-spec.md §1).
function Dashboard() {
  const { user } = useAuth();
  return user?.role === "REQUESTER" ? <RequesterDashboard /> : <StaffDashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/change-password" element={<ChangePassword />} />

          <Route
            path="/"
            element={
              <RequireAuth>
                <HomeRedirect />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <AppShell>
                  <Dashboard />
                </AppShell>
              </RequireAuth>
            }
          />
          <Route
            path="/tickets"
            element={
              <RequireAuth>
                <RequireRole roles={["REQUESTER"]}>
                  <AppShell>
                    <MyTickets />
                  </AppShell>
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/tickets/new"
            element={
              <RequireAuth>
                <RequireRole roles={["REQUESTER"]}>
                  <AppShell>
                    <CreateTicket />
                  </AppShell>
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/tickets/:id"
            element={
              <RequireAuth>
                <RequireRole roles={["REQUESTER"]}>
                  <AppShell>
                    <TicketDetail />
                  </AppShell>
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/staff/queue"
            element={
              <RequireAuth>
                <RequireRole roles={["IT_STAFF", "ADMINISTRATOR"]}>
                  <AppShell>
                    <StaffTicketQueue />
                  </AppShell>
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/staff/tickets/:id"
            element={
              <RequireAuth>
                <RequireRole roles={["IT_STAFF", "ADMINISTRATOR"]}>
                  <AppShell>
                    <StaffTicketDetail />
                  </AppShell>
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/users"
            element={
              <RequireAuth>
                <RequireRole roles={["ADMINISTRATOR"]}>
                  <AppShell>
                    <UserManagement />
                  </AppShell>
                </RequireRole>
              </RequireAuth>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
