import { describe, it, expect } from "vitest";
import { validateTicketInput } from "../../src/validation.js";

describe("validateTicketInput (BR-15, BR-16, BR-17, BR-18)", () => {
  const validInput = {
    categoryId: 1,
    relatedSystemId: 1,
    summary: "Laptop battery drains quickly",
    description: "My laptop battery is draining much faster than usual.",
    requestedPriority: "MEDIUM",
  };

  it("returns no errors for fully valid input", () => {
    expect(validateTicketInput(validInput)).toEqual({});
  });

  it("rejects a Summary shorter than 5 characters", () => {
    const errors = validateTicketInput({ ...validInput, summary: "Hi" });
    expect(errors.summary).toBeDefined();
  });

  it("rejects a Summary longer than 120 characters", () => {
    const errors = validateTicketInput({ ...validInput, summary: "x".repeat(121) });
    expect(errors.summary).toBeDefined();
  });

  it("trims whitespace before checking Summary length", () => {
    const errors = validateTicketInput({ ...validInput, summary: "   Hi   " });
    expect(errors.summary).toBeDefined(); // "Hi" trimmed is only 2 chars
  });

  it("rejects a Description shorter than 10 characters", () => {
    const errors = validateTicketInput({ ...validInput, description: "short" });
    expect(errors.description).toBeDefined();
  });

  it("rejects a missing categoryId", () => {
    const errors = validateTicketInput({ ...validInput, categoryId: undefined });
    expect(errors.categoryId).toBeDefined();
  });

  it("rejects an invalid requestedPriority", () => {
    const errors = validateTicketInput({ ...validInput, requestedPriority: "URGENT" });
    expect(errors.requestedPriority).toBeDefined();
  });
});