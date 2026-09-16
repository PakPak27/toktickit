import { describe, it, expect } from "vitest";
import { STATUS_TRANSITIONS, validNextStatuses, isValidTransition, ALL_STATUSES } from "../../src/statusTransitions.js";

describe("status transition matrix (BR-17, specification.md §5.5)", () => {
  it("matches the documented matrix exactly", () => {
    expect(STATUS_TRANSITIONS).toEqual({
      NEW: ["OPEN", "IN_PROGRESS", "CANCELLED"],
      OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
      IN_PROGRESS: ["OPEN", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
      WAITING_FOR_REQUESTER: ["OPEN", "IN_PROGRESS", "RESOLVED", "CANCELLED"],
      RESOLVED: ["CLOSED", "REOPENED"],
      CLOSED: ["REOPENED"],
      REOPENED: ["OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
      CANCELLED: [],
    });
  });

  it("returns the correct valid-next-status set for every status", () => {
    for (const status of ALL_STATUSES) {
      expect(validNextStatuses(status)).toEqual(STATUS_TRANSITIONS[status]);
    }
  });

  it("treats CANCELLED as terminal", () => {
    expect(validNextStatuses("CANCELLED")).toEqual([]);
  });

  it("rejects NEW -> RESOLVED directly (must go through OPEN/IN_PROGRESS first)", () => {
    expect(isValidTransition("NEW", "RESOLVED")).toBe(false);
  });

  it("accepts every matrix-valid transition", () => {
    for (const [from, tos] of Object.entries(STATUS_TRANSITIONS)) {
      for (const to of tos) {
        expect(isValidTransition(from, to)).toBe(true);
      }
    }
  });

  it("returns an empty array for an unknown status", () => {
    expect(validNextStatuses("NOT_A_STATUS")).toEqual([]);
  });
});
