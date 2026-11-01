import { getPrisma } from "../src/prisma.js";
import { hashPassword } from "../src/auth.js";
import { createTicketWithRetry } from "../src/ticketNumber.js";

// Lab 1 — seed the four supported categories.
const CATEGORY_NAMES = ["Account and Access", "Hardware", "Software", "Network"];

// Lab 3 — seed real authenticated Users (replaces Lab 2's Development
// Requester testing mechanism). Every seeded account shares the same
// documented local-dev-only initial password and must change it at first
// login (specification.md §5.6, BR-37). At least 4 active + 1 inactive
// Requester, 3 active + 1 inactive IT Staff, 1 active Administrator, per
// Lab 3 Labsheet Section 5.3.
const SEED_PASSWORD = "ChangeMe123!";

const USERS: { name: string; email: string; isActive: boolean; role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR" }[] = [
  { name: "Jennifer Anderson", email: "jennifer.anderson@example.com", isActive: true, role: "REQUESTER" },
  { name: "Michael Brown", email: "michael.brown@example.com", isActive: true, role: "REQUESTER" },
  { name: "Sarah Johnson", email: "sarah.johnson@example.com", isActive: true, role: "REQUESTER" },
  { name: "David Lee", email: "david.lee@example.com", isActive: true, role: "REQUESTER" },
  { name: "Retired Account", email: "retired.account@example.com", isActive: false, role: "REQUESTER" },
  { name: "Kevin Patel", email: "kevin.patel@toktickit.com", isActive: true, role: "IT_STAFF" },
  { name: "Emily Davis", email: "emily.davis@toktickit.com", isActive: true, role: "IT_STAFF" },
  { name: "Robert Wilson", email: "robert.wilson@toktickit.com", isActive: true, role: "IT_STAFF" },
  { name: "Former Staff", email: "former.staff@toktickit.com", isActive: false, role: "IT_STAFF" },
  { name: "Amanda Clark", email: "amanda.clark@toktickit.com", isActive: true, role: "ADMINISTRATOR" },
];

// Lab 2 — seed Related Systems. At least 6, per Labsheet Section 5.3.
const RELATED_SYSTEM_NAMES = [
  "Email",
  "Campus Wi-Fi",
  "VPN",
  "LEB2 App",
  "Grade Submission App",
  "Printer",
  "Corporate Laptop",
];

// Lab 4 — realistic seed Tickets covering all 8 statuses, both priorities'
// full range, and assigned/unassigned ownership (Lab 4 Labsheet §5.3).
// Idempotent via (requester email, summary), matching the Lab 3 pattern.
type SeedTicket = {
  requester: string;
  summary: string;
  description: string;
  category: string;
  relatedSystem: string;
  requestedPriority: "LOW" | "MEDIUM" | "HIGH";
  itPriority: "LOW" | "MEDIUM" | "HIGH";
  status: "NEW" | "OPEN" | "IN_PROGRESS" | "WAITING_FOR_REQUESTER" | "RESOLVED" | "CLOSED" | "REOPENED" | "CANCELLED";
  owner: string | null;
};

const SEED_TICKETS: SeedTicket[] = [
  { requester: "jennifer.anderson@example.com", summary: "Cannot sign in to campus email", description: "Outlook rejects my password after the weekend maintenance window.", category: "Account and Access", relatedSystem: "Email", requestedPriority: "HIGH", itPriority: "HIGH", status: "NEW", owner: null },
  { requester: "michael.brown@example.com", summary: "Wi-Fi drops every few minutes in Building 5", description: "Campus Wi-Fi disconnects roughly every ten minutes on the third floor.", category: "Network", relatedSystem: "Campus Wi-Fi", requestedPriority: "MEDIUM", itPriority: "MEDIUM", status: "OPEN", owner: null },
  { requester: "sarah.johnson@example.com", summary: "Shared printer on floor 2 shows offline", description: "The lab printer has displayed Offline since Monday and nobody can print.", category: "Hardware", relatedSystem: "Printer", requestedPriority: "MEDIUM", itPriority: "HIGH", status: "IN_PROGRESS", owner: "kevin.patel@toktickit.com" },
  { requester: "david.lee@example.com", summary: "Request VPN access for remote grading", description: "I need VPN access so I can reach the Grade Submission App from home this term.", category: "Account and Access", relatedSystem: "VPN", requestedPriority: "LOW", itPriority: "LOW", status: "WAITING_FOR_REQUESTER", owner: "emily.davis@toktickit.com" },
  { requester: "jennifer.anderson@example.com", summary: "Laptop battery drains within an hour", description: "My corporate laptop now only lasts about an hour away from the charger.", category: "Hardware", relatedSystem: "Corporate Laptop", requestedPriority: "MEDIUM", itPriority: "MEDIUM", status: "RESOLVED", owner: "robert.wilson@toktickit.com" },
  { requester: "michael.brown@example.com", summary: "Grade Submission App crashes when uploading slides", description: "The app closes unexpectedly whenever I upload a slide deck larger than 20 MB.", category: "Software", relatedSystem: "Grade Submission App", requestedPriority: "HIGH", itPriority: "HIGH", status: "CLOSED", owner: "kevin.patel@toktickit.com" },
  { requester: "sarah.johnson@example.com", summary: "Duplicate request for mailbox quota increase", description: "Submitted twice by mistake, please disregard this duplicate.", category: "Account and Access", relatedSystem: "Email", requestedPriority: "LOW", itPriority: "LOW", status: "CANCELLED", owner: null },
  { requester: "david.lee@example.com", summary: "External monitor not detected after dock update", description: "The external monitor stopped being detected after last week's dock firmware update.", category: "Hardware", relatedSystem: "Corporate Laptop", requestedPriority: "MEDIUM", itPriority: "MEDIUM", status: "REOPENED", owner: "emily.davis@toktickit.com" },
];

// One or more Actions Taken per Ticket summary above — zero, one, and
// multiple per Ticket, including at least one open follow-up (demonstrates
// the Lab 4 resolution gate blocking RESOLVED) and multiple different
// performers on the same Ticket (BR-02: an Action Taken may be by a
// different IT Staff member than the Ticket Owner). Idempotent via
// (ticket summary, action description).
type SeedAction = {
  ticketSummary: string;
  performedBy: string;
  description: string;
  result: string;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
};

const SEED_ACTIONS: SeedAction[] = [
  // "Shared printer on floor 2 shows offline" — one action, open follow-up:
  // demonstrates the resolution gate blocking RESOLVED.
  { ticketSummary: "Shared printer on floor 2 shows offline", performedBy: "kevin.patel@toktickit.com", description: "Power-cycled the printer and reseated the network cable.", result: "Printer came back online briefly, then dropped again after ~10 minutes.", followUpRequired: true, followUpNote: "Suspect a failing network card; need a vendor technician visit before this can be closed.", attachmentNotes: "printer-error-log.png on the shared drive" },
  // "Request VPN access for remote grading" — two actions, two different
  // performers, still open: demonstrates multi-performer + open follow-up.
  { ticketSummary: "Request VPN access for remote grading", performedBy: "emily.davis@toktickit.com", description: "Verified the Requester's faculty status and submitted the VPN provisioning request.", result: "Provisioning request submitted to the network team.", followUpRequired: true, followUpNote: "Waiting on network team confirmation before credentials can be issued.", attachmentNotes: null },
  { ticketSummary: "Request VPN access for remote grading", performedBy: "robert.wilson@toktickit.com", description: "Followed up with the network team on the pending provisioning request.", result: "Network team confirmed the request is queued, ETA two business days.", followUpRequired: true, followUpNote: "Still waiting on network team; check back in two business days.", attachmentNotes: null },
  // "Laptop battery drains within an hour" — one action, no open follow-up:
  // a legitimately RESOLVED ticket under the new gate.
  { ticketSummary: "Laptop battery drains within an hour", performedBy: "robert.wilson@toktickit.com", description: "Replaced the battery pack and ran a full charge/discharge cycle test.", result: "New battery holds a full workday charge; issue resolved.", followUpRequired: false, followUpNote: null, attachmentNotes: "battery-test-results.pdf on the shared drive" },
  // "Grade Submission App crashes when uploading slides" — two actions, both
  // closed out: multiple-actions-no-open-follow-up case.
  { ticketSummary: "Grade Submission App crashes when uploading slides", performedBy: "kevin.patel@toktickit.com", description: "Reproduced the crash locally with a 25 MB slide deck.", result: "Confirmed a server-side upload size limit was the cause.", followUpRequired: true, followUpNote: "Escalate to the Grade Submission App vendor for a limit increase.", attachmentNotes: null },
  { ticketSummary: "Grade Submission App crashes when uploading slides", performedBy: "kevin.patel@toktickit.com", description: "Vendor increased the upload size limit to 50 MB; re-tested the original file.", result: "Upload now succeeds; issue resolved and Ticket closed.", followUpRequired: false, followUpNote: null, attachmentNotes: null },
  // "External monitor not detected after dock update" — one action, open
  // follow-up on a REOPENED Ticket: reopened because the problem persisted.
  { ticketSummary: "External monitor not detected after dock update", performedBy: "emily.davis@toktickit.com", description: "Rolled back the dock firmware to the previous version.", result: "Monitor detected again immediately after rollback, but the Requester reports it recurred two days later — Ticket reopened.", followUpRequired: true, followUpNote: "Rollback is only a workaround; needs a permanent fix from the dock vendor.", attachmentNotes: null },
  // "Cannot sign in to campus email", "Wi-Fi drops every few minutes in
  // Building 5", and "Duplicate request for mailbox quota increase" are
  // deliberately left with zero Actions Taken (new/unworked/cancelled).
];

async function seedTickets() {
  const prisma = getPrisma();
  let created = 0;
  for (const t of SEED_TICKETS) {
    const requester = await prisma.user.findUnique({ where: { email: t.requester } });
    if (!requester) continue;
    const existing = await prisma.ticket.findFirst({ where: { requesterId: requester.id, summary: t.summary } });
    if (existing) continue;

    const category = await prisma.category.findUniqueOrThrow({ where: { name: t.category } });
    const relatedSystem = await prisma.relatedSystem.findUniqueOrThrow({ where: { name: t.relatedSystem } });
    const owner = t.owner ? await prisma.user.findUniqueOrThrow({ where: { email: t.owner } }) : null;

    await createTicketWithRetry(prisma, (ticketNumber) =>
      prisma.ticket.create({
        data: {
          ticketNumber,
          requesterId: requester.id,
          ticketOwnerId: owner?.id ?? null,
          categoryId: category.id,
          relatedSystemId: relatedSystem.id,
          summary: t.summary,
          description: t.description,
          requestedPriority: t.requestedPriority,
          itPriority: t.itPriority,
          currentStatus: t.status,
        },
      })
    );
    created++;
  }
  console.log(`Seeded tickets (idempotent): ${created} new, ${SEED_TICKETS.length - created} already present.`);
}

async function seedActionsTaken() {
  const prisma = getPrisma();
  let created = 0;
  for (const a of SEED_ACTIONS) {
    const ticket = await prisma.ticket.findFirst({ where: { summary: a.ticketSummary } });
    if (!ticket) continue;
    const performer = await prisma.user.findUnique({ where: { email: a.performedBy } });
    if (!performer) continue;

    const existing = await prisma.actionTaken.findFirst({
      where: { ticketId: ticket.id, description: a.description },
    });
    if (existing) continue;

    await prisma.actionTaken.create({
      data: {
        ticketId: ticket.id,
        performedById: performer.id,
        description: a.description,
        result: a.result,
        followUpRequired: a.followUpRequired,
        followUpNote: a.followUpNote,
        attachmentNotes: a.attachmentNotes,
      },
    });
    created++;
  }
  console.log(`Seeded actions taken (idempotent): ${created} new, ${SEED_ACTIONS.length - created} already present.`);
}

async function main() {
  const prisma = getPrisma();

  for (const name of CATEGORY_NAMES) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log(`Seeded ${CATEGORY_NAMES.length} categories.`);

  // Only backfill passwordHash/mustChangePassword when the row doesn't
  // already have a real hash — this covers the one-time migration of Lab 2
  // RequesterUser rows (whose passwordHash starts as the '' migration
  // placeholder, see prisma/migrations/*_lab3_add_user_auth_model) without
  // clobbering a password an account holder may have legitimately changed
  // since, on every later re-run of this idempotent seed.
  const passwordHash = await hashPassword(SEED_PASSWORD);
  for (const user of USERS) {
    const existing = await prisma.user.findUnique({ where: { email: user.email } });
    const needsPasswordBackfill = !existing || existing.passwordHash === "";
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        isActive: user.isActive,
        role: user.role,
        ...(needsPasswordBackfill ? { passwordHash, mustChangePassword: true } : {}),
      },
      create: { ...user, passwordHash, mustChangePassword: true },
    });
  }
  console.log(`Seeded ${USERS.length} users. Local-dev password for all: "${SEED_PASSWORD}"`);

  for (const name of RELATED_SYSTEM_NAMES) {
    await prisma.relatedSystem.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log(`Seeded ${RELATED_SYSTEM_NAMES.length} related systems.`);

  await seedTickets();
  await seedActionsTaken();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });