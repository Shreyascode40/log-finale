/**
 * Seed: 1 HOD, 3 guides, 8 students.
 *
 * Feature seeds are added by the feature that needs them:
 *   F3 -> demo group statuses, F7 -> schedule, F9 -> activity templates,
 *   F10/F13 -> review templates + questions, F11 -> examiner questions.
 *
 * Run with: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "Password@123";

const STAFF = [
  { name: "Dr. Anil Deshmukh", email: "hod@apcoer.edu.in", role: "HOD", mobile: "9000000001" },
  { name: "Dr. Sunita Kulkarni", email: "guide1@apcoer.edu.in", role: "GUIDE", mobile: "9000000002" },
  { name: "Prof. Mahesh Pawar", email: "guide2@apcoer.edu.in", role: "GUIDE", mobile: "9000000003" },
  { name: "Prof. Rekha Jadhav", email: "guide3@apcoer.edu.in", role: "GUIDE", mobile: "9000000004" },
] as const;

const STUDENTS = [
  { name: "Rahul Patil", rollNo: "TE2101", mobile: "9100000001" },
  { name: "Sneha Joshi", rollNo: "TE2102", mobile: "9100000002" },
  { name: "Amit Shinde", rollNo: "TE2103", mobile: "9100000003" },
  { name: "Priya More", rollNo: "TE2104", mobile: "9100000004" },
  { name: "Vikas Gaikwad", rollNo: "TE2105", mobile: "9100000005" },
  { name: "Neha Sawant", rollNo: "TE2106", mobile: "9100000006" },
  { name: "Rohan Kulkarni", rollNo: "TE2107", mobile: "9100000007" },
  { name: "Pooja Bhosale", rollNo: "TE2108", mobile: "9100000008" },
] as const;

async function main() {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const now = new Date();

  for (const staff of STAFF) {
    await prisma.user.upsert({
      where: { email: staff.email },
      update: { name: staff.name, role: staff.role, mobile: staff.mobile, active: true },
      create: {
        name: staff.name,
        email: staff.email,
        role: staff.role,
        mobile: staff.mobile,
        passwordHash,
        emailVerifiedAt: now,
        createdVia: "HOD_CREATED",
      },
    });
  }

  for (const student of STUDENTS) {
    const email = `${student.rollNo.toLowerCase()}@apcoer.edu.in`;
    await prisma.user.upsert({
      where: { email },
      update: { name: student.name, rollNo: student.rollNo, mobile: student.mobile, active: true },
      create: {
        name: student.name,
        email,
        rollNo: student.rollNo,
        mobile: student.mobile,
        role: "STUDENT",
        passwordHash,
        emailVerifiedAt: now,
        createdVia: "SELF_SIGNUP",
      },
    });
  }

  // ------------------------------------------------------------------ groups
  // G1 is complete and SUBMITTED so F3 (approve, reject, assign) has data.
  // G2 is a DRAFT with only its creator, leaving three students free so F4
  // (create, invite, submit) can be exercised with seeded logins.
  // Created only when no groups exist, so re-running the seed never duplicates.
  if ((await prisma.group.count()) === 0) {
    const students = await prisma.user.findMany({
      where: { role: "STUDENT" },
      orderBy: { rollNo: "asc" },
    });

    const DEMO_GROUPS = [
      {
        groupNo: "G1",
        projectTitle: "Smart Attendance System using Face Recognition",
        area: "Artificial Intelligence",
        status: "SUBMITTED",
        from: 0,
        to: 4,
      },
      {
        groupNo: "G2",
        projectTitle: "Campus Placement and Training Portal",
        area: "Web Development",
        status: "DRAFT",
        from: 4,
        to: 5,
      },
    ];

    for (const spec of DEMO_GROUPS) {
      const memberUsers = students.slice(spec.from, spec.to);
      const creator = memberUsers[0];
      if (!creator) continue;

      await prisma.group.create({
        data: {
          groupNo: spec.groupNo,
          academicYear: "2025-26",
          department: "Computer Engineering",
          projectTitle: spec.projectTitle,
          area: spec.area,
          status: spec.status,
          creatorId: creator.id,
          members: {
            create: memberUsers.map((member, index) => ({
              userId: member.id,
              name: member.name,
              rollNo: member.rollNo,
              email: member.email,
              mobile: member.mobile,
              teResult: "Passed",
              examSeatNo: `S${member.rollNo ?? index}`,
              memberType: index === 0 ? "creator" : "member",
            })),
          },
        },
      });
    }
  }

  console.log(`Seeded ${STAFF.length} staff and ${STUDENTS.length} students.`);
  console.log(`All demo accounts use the password: ${DEMO_PASSWORD}`);
  console.log(`HOD: ${STAFF[0]!.email} | Guides: ${STAFF.slice(1).map((s) => s.email).join(", ")}`);
  console.log(`Students: ${STUDENTS.map((s) => `${s.rollNo.toLowerCase()}@apcoer.edu.in`).join(", ")}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
