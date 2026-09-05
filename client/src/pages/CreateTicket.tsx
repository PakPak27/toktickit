import { useEffect, useState } from "react";
import {
  fetchCategories,
  fetchRelatedSystems,
  createTicket,
  CategoryDto,
  RelatedSystemDto,
  TicketValidationError,
} from "../api/tickets.js";
import { useRequester } from "../context/RequesterContext.js";

type Priority = "LOW" | "MEDIUM" | "HIGH";
type SubmitState = "idle" | "submitting" | "success" | "error";

export default function CreateTicket() {
  const { requester } = useRequester();

  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<RelatedSystemDto[]>([]);
  const [refDataError, setRefDataError] = useState(false);

  const [categoryId, setCategoryId] = useState<number | "">("");
  const [relatedSystemId, setRelatedSystemId] = useState<number | "">("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [requestedPriority, setRequestedPriority] = useState<Priority | "">("");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitError, setSubmitError] = useState("");
  const [ticketNumber, setTicketNumber] = useState("");

  useEffect(() => {
    Promise.all([fetchCategories(), fetchRelatedSystems()])
      .then(([cats, systems]) => {
        setCategories(cats);
        setRelatedSystems(systems);
      })
      .catch(() => setRefDataError(true));
  }, []);

  function validateClientSide(): Record<string, string> {
  const errors: Record<string, string> = {};

  const trimmedSummary = summary.trim();
  if (trimmedSummary.length < 5 || trimmedSummary.length > 120) {
    errors.summary = "Summary must be between 5 and 120 characters";
  }

  const trimmedDescription = description.trim();
  if (trimmedDescription.length < 10 || trimmedDescription.length > 2000) {
    errors.description = "Description must be between 10 and 2000 characters";
  }

  if (categoryId === "") {
    errors.categoryId = "Category is required";
  }

  if (relatedSystemId === "") {
    errors.relatedSystemId = "Related System is required";
  }

  if (requestedPriority === "") {
    errors.requestedPriority = "Requested Priority must be LOW, MEDIUM, or HIGH";
  }

  return errors;
}

async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  if (!requester) return;

  setSubmitError("");

  // AC-04 / UI-03: validate on the client first — do not call the API at all
  // when required fields are missing or invalid.
  const clientErrors = validateClientSide();
  if (Object.keys(clientErrors).length > 0) {
    setFieldErrors(clientErrors);
    return;
  }

  setFieldErrors({});
  setSubmitState("submitting");

  try {
    const result = await createTicket(requester.id, {
      categoryId: categoryId as number,
      relatedSystemId: relatedSystemId as number,
      summary,
      description,
      requestedPriority: requestedPriority as Priority,
    });
    setTicketNumber(result.ticketNumber);
    setSubmitState("success");
  } catch (err) {
    if (err instanceof TicketValidationError) {
      setFieldErrors(err.fields);
      setSubmitState("idle"); // BR-20: retain values, let user fix and resubmit
    } else {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitState("error"); // BR-20: values are preserved since state isn't cleared
    }
  }
}

  if (submitState === "success") {
    return (
      <div className="card border-0 shadow-sm p-4" style={{ maxWidth: 520 }}>
        <div style={{ background: "#EAF6EF", color: "#0B7A46" }} className="p-3 rounded mb-3">
          <h2 className="h5 mb-1">Ticket created successfully</h2>
          <p className="mb-0">
            Your ticket number is <strong>{ticketNumber}</strong>.
          </p>
        </div>
        <a href="/tickets" className="btn btn-success">
          Go to My Tickets
        </a>
      </div>
    );
  }

  return (
    <div className="card border-0 shadow-sm p-4" style={{ maxWidth: 720 }}>
      <h1 className="h4 mb-4">Create Ticket</h1>

      {refDataError && (
        <div className="alert alert-danger">
          Unable to load categories or related systems. Please try again later.
        </div>
      )}

      {submitState === "error" && (
        <div className="alert alert-danger">{submitError}</div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="row g-3 mb-3">
          <div className="col-md-6">
            <label htmlFor="categorySelect" className="form-label fw-semibold">
              Category <span className="text-danger">*</span>
            </label>
            <select
              id="categorySelect"
              className="form-select"
              value={categoryId}
              onChange={(e) => setCategoryId(Number(e.target.value))}
            >
              <option value="" disabled>Choose a category…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {fieldErrors.categoryId && (
              <div className="text-danger small mt-1">{fieldErrors.categoryId}</div>
            )}
          </div>

          <div className="col-md-6">
            <label htmlFor="relatedSystemSelect" className="form-label fw-semibold">
              Related System <span className="text-danger">*</span>
            </label>
            <select
              id="relatedSystemSelect"
              className="form-select"
              value={relatedSystemId}
              onChange={(e) => setRelatedSystemId(Number(e.target.value))}
            >
              <option value="" disabled>Choose a related system…</option>
              {relatedSystems.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {fieldErrors.relatedSystemId && (
              <div className="text-danger small mt-1">{fieldErrors.relatedSystemId}</div>
            )}
          </div>
        </div>

        <div className="mb-3">
          <label htmlFor="prioritySelect" className="form-label fw-semibold">
            Requested Priority <span className="text-danger">*</span>
          </label>
          <select
            id="prioritySelect"
            className="form-select"
            style={{ maxWidth: 240 }}
            value={requestedPriority}
            onChange={(e) => setRequestedPriority(e.target.value as Priority)}
          >
            <option value="" disabled>Choose a priority…</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
          {fieldErrors.requestedPriority && (
            <div className="text-danger small mt-1">{fieldErrors.requestedPriority}</div>
          )}
        </div>

        <div className="mb-3">
          <label htmlFor="summaryInput" className="form-label fw-semibold">
            Summary <span className="text-danger">*</span>
          </label>
          <input
            id="summaryInput"
            type="text"
            className="form-control"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            maxLength={120}
          />
          {fieldErrors.summary && (
            <div className="text-danger small mt-1">{fieldErrors.summary}</div>
          )}
        </div>

        <div className="mb-4">
          <label htmlFor="descriptionInput" className="form-label fw-semibold">
            Description <span className="text-danger">*</span>
          </label>
          <textarea
            id="descriptionInput"
            className="form-control"
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
          />
          {fieldErrors.description && (
            <div className="text-danger small mt-1">{fieldErrors.description}</div>
          )}
        </div>

        <button
          type="submit"
          className="btn btn-success"
          disabled={submitState === "submitting"}
        >
          {submitState === "submitting" ? "Submitting…" : "Submit Ticket"}
        </button>
      </form>
    </div>
  );
}