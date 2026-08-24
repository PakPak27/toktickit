import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchActiveRequesters, RequesterDto } from "../api/requesters.js";
import { useRequester } from "../context/RequesterContext.js";

type LoadState = "loading" | "success" | "empty" | "error";

export default function RequesterSelection() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [requesters, setRequesters] = useState<RequesterDto[]>([]);
  const [selectedId, setSelectedId] = useState<number | "">("");
  const { selectRequester } = useRequester();
  const navigate = useNavigate();

  useEffect(() => {
    fetchActiveRequesters()
      .then((data) => {
        setRequesters(data);
        setLoadState(data.length === 0 ? "empty" : "success");
      })
      .catch(() => setLoadState("error"));
  }, []);

  function handleContinue() {
    const chosen = requesters.find((r) => r.id === selectedId);
    if (!chosen) return;
    selectRequester(chosen);
    navigate("/tickets");
  }

  return (
    <div className="container py-5" style={{ maxWidth: 520 }}>
      <div className="card shadow-sm border-0 p-4">
        <h1 className="h4 text-center mb-1">Select Development Requester</h1>
        <p className="text-muted text-center small mb-4">
          Choose a development requester to simulate the current requester context for Lab 2.
          This is for testing only and is not a login screen.
        </p>

        {loadState === "loading" && <p className="text-center text-muted">Loading…</p>}

        {loadState === "error" && (
          <div className="alert alert-danger">
            Unable to load development requesters. Please make sure the backend is running
            and try again.
          </div>
        )}

        {loadState === "empty" && (
          <div className="alert alert-warning">
            No active development requesters were found. Please seed the database.
          </div>
        )}

        {loadState === "success" && (
          <>
            <label htmlFor="requesterSelect" className="form-label fw-semibold">
              Development Requester <span className="text-danger">*</span>
            </label>
            <select
              id="requesterSelect"
              className="form-select mb-3"
              value={selectedId}
              onChange={(e) => setSelectedId(Number(e.target.value))}
            >
              <option value="" disabled>
                Choose a requester…
              </option>
              {requesters.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>

            <div className="alert" style={{ background: "#EAF6EF", color: "#0B7A46" }}>
              Only active development requesters are shown.
            </div>

            <div className="alert alert-secondary small">
              <strong>Authentication coming in Lab 3.</strong> In Lab 3, this selection will
              be replaced with secure authentication so you can access the system with your
              own account.
            </div>

            <button
              className="btn btn-success w-100 mt-2"
              disabled={selectedId === ""}
              onClick={handleContinue}
            >
              Continue →
            </button>
          </>
        )}
      </div>
    </div>
  );
}