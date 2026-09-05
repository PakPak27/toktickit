import { describe, it, expect, beforeEach } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import { generateTicketNumber } from "../../src/ticketNumber.js";

describe("generateTicketNumber (BR-01)", () => {
  it("returns the correct format TKT-YYYY-NNNNNN", async () => {
    const ticketNumber = await generateTicketNumber(getPrisma());
    const year = new Date().getFullYear();
    expect(ticketNumber).toMatch(new RegExp(`^TKT-${year}-\\d{6}$`));
  });
});