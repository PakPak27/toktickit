import { getPrisma } from "../src/prisma.js";

// Issue 3 — seed the four supported categories.
// Running this twice must NOT create duplicates (idempotent via upsert).
const CATEGORY_NAMES = ["Account and Access", "Hardware", "Software", "Network"];

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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });