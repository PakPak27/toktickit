import { BrowserRouter, Routes, Route } from "react-router-dom";
import { RequesterProvider } from "./context/RequesterContext.js";
import { AuthProvider } from "./context/AuthContext.js";
import RequireRequester from "./components/RequireRequester.js";
import AppShell from "./components/AppShell.js";
import RequesterSelection from "./pages/RequesterSelection.js";
import CreateTicket from "./pages/CreateTicket.js";
import MyTickets from "./pages/MyTickets.js";
import TicketDetail from "./pages/TicketDetail.js";
import Login from "./pages/Login.js";
import ChangePassword from "./pages/ChangePassword.js";

export default function App() {
  return (
    <AuthProvider>
      <RequesterProvider>
        <BrowserRouter>
          <Routes>
            {/* Lab 3 authentication — additive for Issue #2; the Requester
                flow below still runs on the Development Requester selector
                until Issue #3 migrates it to the authenticated session. */}
            <Route path="/login" element={<Login />} />
            <Route path="/change-password" element={<ChangePassword />} />

            <Route path="/" element={<RequesterSelection />} />
            <Route
              path="/tickets"
              element={
                <RequireRequester>
                  <AppShell>
                    <MyTickets />
                  </AppShell>
                </RequireRequester>
              }
            />
            <Route
              path="/tickets/new"
              element={
                <RequireRequester>
                  <AppShell>
                    <CreateTicket />
                  </AppShell>
                </RequireRequester>
              }
            />
            <Route
              path="/tickets/:id"
              element={
                <RequireRequester>
                  <AppShell>
                    <TicketDetail />
                  </AppShell>
                </RequireRequester>
              }
            />
          </Routes>
        </BrowserRouter>
      </RequesterProvider>
    </AuthProvider>
  );
}
