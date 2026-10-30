/**
 * Seed: 1 HOD account only.
 *
 * Structural seeds (schedule, activity templates, review templates) are
 * kept because they define the logbook structure, not user data.
 *
 * Run with: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";
import { SCHEDULE_SEED } from "./seed-data/schedule";
import { ACTIVITY_SEED } from "./seed-data/activity";
import { REVIEW_SEED } from "./seed-data/reviews";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "Password@123";

async function main() {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const now = new Date();

  // ------------------------------------------------------------------ HOD
  await prisma.user.upsert({
    where: { email: "hod@apcoer.edu.in" },
    update: { name: "Dr. Rama Gaikwad", role: "HOD", mobile: "9000000001", active: true },
    create: {
      name: "Dr. Rama Gaikwad",
      email: "hod@apcoer.edu.in",
      role: "HOD",
      mobile: "9000000001",
      passwordHash,
      emailVerifiedAt: now,
      createdVia: "HOD_CREATED",
    },
  });

  // ------------------------------------------------------------------ schedule
  for (const row of SCHEDULE_SEED) {
    await prisma.scheduleItem.upsert({
      where: { term_sortOrder: { term: row.term, sortOrder: row.sortOrder } },
      update: { description: row.description },
      create: { term: row.term, sortOrder: row.sortOrder, description: row.description },
    });
  }

  // ------------------------------------------------------------------ activity
  for (const row of ACTIVITY_SEED) {
    await prisma.activityTemplate.upsert({
      where: { month_sortOrder: { month: row.month, sortOrder: row.sortOrder } },
      update: { text: row.text },
      create: { month: row.month, sortOrder: row.sortOrder, text: row.text },
    });
  }

  // ------------------------------------------------------------------ reviews
  for (const template of REVIEW_SEED) {
    const saved = await prisma.reviewTemplate.upsert({
      where: { reviewType: template.reviewType },
      update: { title: template.title, term: template.term, order: template.order, hasDateColumn: template.hasDateColumn },
      create: {
        term: template.term,
        reviewType: template.reviewType,
        title: template.title,
        order: template.order,
        hasDateColumn: template.hasDateColumn,
      },
    });
    for (let index = 0; index < template.questions.length; index += 1) {
      const text = template.questions[index]!;
      await prisma.reviewQuestion.upsert({
        where: { templateId_questionNo: { templateId: saved.id, questionNo: index + 1 } },
        update: { text },
        create: { templateId: saved.id, questionNo: index + 1, text },
      });
    }
  }

  console.log(`Seeded HOD account.`);
  console.log(`HOD login: hod@apcoer.edu.in / ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
