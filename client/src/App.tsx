import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.js";
import RequireAuth from "./components/RequireAuth.js";
import AppShell from "./components/AppShell.js";
import CreateTicket from "./pages/CreateTicket.js";
import MyTickets from "./pages/MyTickets.js";
import TicketDetail from "./pages/TicketDetail.js";
import Login from "./pages/Login.js";
import ChangePassword from "./pages/ChangePassword.js";

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
                <Navigate to="/tickets" replace />
              </RequireAuth>
            }
          />
          <Route
            path="/tickets"
            element={
              <RequireAuth>
                <AppShell>
                  <MyTickets />
                </AppShell>
              </RequireAuth>
            }
          />
          <Route
            path="/tickets/new"
            element={
              <RequireAuth>
                <AppShell>
                  <CreateTicket />
                </AppShell>
              </RequireAuth>
            }
          />
          <Route
            path="/tickets/:id"
            element={
              <RequireAuth>
                <AppShell>
                  <TicketDetail />
                </AppShell>
              </RequireAuth>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
