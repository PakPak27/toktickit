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
import Login from "./pages/Login.js";
import ChangePassword from "./pages/ChangePassword.js";

// Every role has a different "home" screen — routed once here instead of
// hard-coding "/tickets" everywhere a redirect target is needed.
function HomeRedirect() {
  const { user } = useAuth();
  const target = user?.role === "REQUESTER" ? "/tickets" : "/staff/queue";
  return <Navigate to={target} replace />;
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
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
