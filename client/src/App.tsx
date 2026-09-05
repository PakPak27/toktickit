import { BrowserRouter, Routes, Route } from "react-router-dom";
import { RequesterProvider } from "./context/RequesterContext.js";
import RequireRequester from "./components/RequireRequester.js";
import AppShell from "./components/AppShell.js";
import RequesterSelection from "./pages/RequesterSelection.js";
import CreateTicket from "./pages/CreateTicket.js";

// Placeholder screens — real implementations arrive in Issues #4, #5.
function MyTicketsPlaceholder() {
  return <div>My Tickets (coming in Issue #4)</div>;
}

function TicketDetailPlaceholder() {
  return <div>Ticket Detail (coming in Issue #5)</div>;
}

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
                  <MyTicketsPlaceholder />
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
                  <TicketDetailPlaceholder />
                </AppShell>
              </RequireRequester>
            }
          />
        </Routes>
      </BrowserRouter>
    </RequesterProvider>
  );
}