import { describe, it, expect } from "vitest";
import { evaluateResolutionGate } from "../../src/resolutionGate.js";

describe("evaluateResolutionGate (BR-11, BR-12)", () => {
  it("blocks with NO_ACTIONS when the list is empty", () => {
    const result = evaluateResolutionGate([]);
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("NO_ACTIONS");
    expect(result.blockingActions).toEqual([]);
  });

  it("blocks with OPEN_FOLLOW_UP and lists every open-follow-up action", () => {
    const result = evaluateResolutionGate([
      { id: 1, description: "Checked the printer.", followUpRequired: false },
      { id: 2, description: "Escalated to the vendor.", followUpRequired: true },
      { id: 3, description: "Needs a second visit.", followUpRequired: true },
    ]);
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("OPEN_FOLLOW_UP");
    expect(result.blockingActions).toEqual([
      { id: 2, description: "Escalated to the vendor." },
      { id: 3, description: "Needs a second visit." },
    ]);
  });

  it("is not blocked once at least one action exists and none has an open follow-up", () => {
    const result = evaluateResolutionGate([
      { id: 1, description: "Reset the password.", followUpRequired: false },
    ]);
    expect(result.blocked).toBe(false);
    expect(result.reason).toBeNull();
    expect(result.blockingActions).toEqual([]);
  });
});
