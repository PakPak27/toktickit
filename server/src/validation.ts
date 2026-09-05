export interface FieldErrors {
  [field: string]: string;
}

// BR-15/BR-16: trim + length checks for Summary and Description.
export function validateTicketInput(input: {
  summary?: unknown;
  description?: unknown;
  categoryId?: unknown;
  relatedSystemId?: unknown;
  requestedPriority?: unknown;
}): FieldErrors {
  const errors: FieldErrors = {};

  const summary = typeof input.summary === "string" ? input.summary.trim() : "";
  if (summary.length < 5 || summary.length > 120) {
    errors.summary = "Summary must be between 5 and 120 characters";
  }

  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (description.length < 10 || description.length > 2000) {
    errors.description = "Description must be between 10 and 2000 characters";
  }

  if (typeof input.categoryId !== "number") {
    errors.categoryId = "Category is required";
  }

  if (typeof input.relatedSystemId !== "number") {
    errors.relatedSystemId = "Related System is required";
  }

  const validPriorities = ["LOW", "MEDIUM", "HIGH"];
  if (typeof input.requestedPriority !== "string" || !validPriorities.includes(input.requestedPriority)) {
    errors.requestedPriority = "Requested Priority must be LOW, MEDIUM, or HIGH";
  }

  return errors;
}