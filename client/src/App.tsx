import { BrowserRouter, Routes, Route } from "react-router-dom";
import { RequesterProvider } from "./context/RequesterContext.js";
import RequireRequester from "./components/RequireRequester.js";
import AppShell from "./components/AppShell.js";
import RequesterSelection from "./pages/RequesterSelection.js";
import CreateTicket from "./pages/CreateTicket.js";
import MyTickets from "./pages/MyTickets.js";
import TicketDetail from "./pages/TicketDetail.js";

export default function App() {
  return (
    <RequesterProvider>
      <BrowserRouter>
        <Routes>
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
  );
}