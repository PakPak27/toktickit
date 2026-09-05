import { PrismaClient } from "@prisma/client";

// BR-01: TKT-YYYY-NNNNNN, sequential per year, unique.
// Known limitation (see tests.md Section 7): not race-condition-safe under
// true concurrent creation; acceptable for Lab 2 scope.
export async function generateTicketNumber(prisma: PrismaClient): Promise<string> {
  const year = new Date().getFullYear();
  const yearStart = new Date(`${year}-01-01T00:00:00.000Z`);
  const yearEnd = new Date(`${year + 1}-01-01T00:00:00.000Z`);

  const countThisYear = await prisma.ticket.count({
    where: { createdAt: { gte: yearStart, lt: yearEnd } },
  });

  const sequence = String(countThisYear + 1).padStart(6, "0");
  return `TKT-${year}-${sequence}`;
}