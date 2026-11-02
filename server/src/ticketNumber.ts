import { PrismaClient, Prisma } from "@prisma/client";

// BR-01: TKT-YYYY-NNNNNN, sequential per year, unique.
// Retries on unique-constraint collisions from concurrent creation (P2002),
// since reading-then-inserting is not atomic under true concurrency.
//
// Based on the highest existing sequence number this year, not a row count:
// a count would stay permanently behind the real highest number as soon as
// any Ticket in the sequence is ever deleted (e.g. test cleanup), and since
// nothing else changes between retry attempts, every retry would keep
// recomputing that same already-taken number and never succeed.
export async function generateTicketNumber(prisma: PrismaClient): Promise<string> {
  const year = new Date().getFullYear();
  const yearStart = new Date(`${year}-01-01T00:00:00.000Z`);
  const yearEnd = new Date(`${year + 1}-01-01T00:00:00.000Z`);

  const latest = await prisma.ticket.findFirst({
    where: { createdAt: { gte: yearStart, lt: yearEnd } },
    orderBy: { ticketNumber: "desc" },
    select: { ticketNumber: true },
  });
  const lastSequence = latest ? Number(latest.ticketNumber.slice(-6)) : 0;

  const sequence = String(lastSequence + 1).padStart(6, "0");
  return `TKT-${year}-${sequence}`;
}

// Retries ticket creation on a ticketNumber collision (P2002), generating a
// fresh number each attempt. Bounded to avoid infinite loops.
export async function createTicketWithRetry<T>(
  prisma: PrismaClient,
  attempt: (ticketNumber: string) => Promise<T>,
  maxRetries = 5
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < maxRetries; i++) {
    const ticketNumber = await generateTicketNumber(prisma);
    try {
      return await attempt(ticketNumber);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002" &&
        (err.meta?.target as string[])?.includes("ticketNumber")
      ) {
        lastError = err;
        continue; // collision — try again with a freshly generated number
      }
      throw err;
    }
  }
  throw lastError;
}