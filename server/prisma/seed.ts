import { getPrisma } from "../src/prisma.js";
import { hashPassword } from "../src/auth.js";

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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });