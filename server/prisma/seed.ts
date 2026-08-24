import { getPrisma } from "../src/prisma.js";

// Lab 1 — seed the four supported categories.
const CATEGORY_NAMES = ["Account and Access", "Hardware", "Software", "Network"];

// Lab 2 — seed Development Requesters (testing mechanism only, not real users).
// At least 4 active + 1 inactive, per Labsheet Section 5.3.
const REQUESTERS: { name: string; email: string; isActive: boolean }[] = [
  { name: "Jennifer Anderson", email: "jennifer.anderson@example.com", isActive: true },
  { name: "Michael Brown", email: "michael.brown@example.com", isActive: true },
  { name: "Sarah Johnson", email: "sarah.johnson@example.com", isActive: true },
  { name: "David Lee", email: "david.lee@example.com", isActive: true },
  { name: "Retired Account", email: "retired.account@example.com", isActive: false },
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

  for (const requester of REQUESTERS) {
    await prisma.requesterUser.upsert({
      where: { email: requester.email },
      update: { name: requester.name, isActive: requester.isActive },
      create: requester,
    });
  }
  console.log(`Seeded ${REQUESTERS.length} development requesters.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });