import { describe, it, expect } from "vitest";
import { passwordRuleFailures } from "../../src/auth.js";

// UNIT-01 (BR-07): 8+ chars, upper, lower, digit, special character.
describe("passwordRuleFailures", () => {
  it("accepts a compliant password", () => {
    expect(passwordRuleFailures("N3wSecret!Pass")).toEqual([]);
  });

  it("rejects a password under 8 characters", () => {
    expect(passwordRuleFailures("Ab1!")).toContain("Password must be at least 8 characters");
  });

  it("rejects a password missing an uppercase letter", () => {
    expect(passwordRuleFailures("lowercase1!")).toContain("Password must include an uppercase letter");
  });

  it("rejects a password missing a lowercase letter", () => {
    expect(passwordRuleFailures("UPPERCASE1!")).toContain("Password must include a lowercase letter");
  });

  it("rejects a password missing a digit", () => {
    expect(passwordRuleFailures("NoDigitsHere!")).toContain("Password must include a digit");
  });

  it("rejects a password missing a special character", () => {
    expect(passwordRuleFailures("NoSpecial123")).toContain("Password must include a special character");
  });
});
