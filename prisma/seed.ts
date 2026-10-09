/**
 * Seed skeleton.
 *
 * Per the build order, data seeds are added by the feature that needs them:
 *   F2  -> HOD, guides, students
 *   F3  -> group + guide assignment demo data
 *   F7  -> schedule rows
 *   F9  -> activity templates
 *   F10/F13 -> review templates + questions
 *   F11 -> examiner feedback questions
 *
 * Run with: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seed skeleton: nothing to seed yet (see prisma/seed.ts).");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
