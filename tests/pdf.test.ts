import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import type { Role } from "@/lib/roles";
import { checkPdfGate } from "@/lib/services/pdf";

/**
 * F16 — PDF gate. Proves the server re-checks role, completion and HOD
 * permission (403 with the missing list otherwise). Rendering itself runs in
 * a real browser and is verified live, not here.
 */

type Actor = { id: string; role: Role; name: string };

const createdEmails: string[] = [];
const createdUserIds: string[] = [];
const createdGroupIds: string[] = [];

const rid = () => Math.random().toString(36).slice(2, 10);

async function makeUser(role: string, label: string): Promise<Actor> {
  const id = rid();
  const email = `${label}.${id}@apcoer.edu.in`;
  createdEmails.push(email);
  const user = await prisma.user.create({
    data: {
      name: `${label} ${id}`,
      email,
      role,
      rollNo: role === "STUDENT" ? `R${id}` : null,
      mobile: "9000000000",
      passwordHash: await hashPassword("Password@123"),
      emailVerifiedAt: new Date(),
      createdVia: role === "STUDENT" ? "SELF_SIGNUP" : "HOD_CREATED",
    },
  });
  createdUserIds.push(user.id);
  return { id: user.id, role: user.role as Role, name: user.name };
}

async function makeGroup(creator: Actor, guide: Actor | null, extra: Record<string, unknown> = {}) {
  const group = await prisma.group.create({
    data: {
      code: `C${rid()}`,
      groupNo: `G${rid()}`,
      projectTitle: "Vitest PDF project",
      status: "ACTIVE",
      creatorId: creator.id,
      guideId: guide?.id ?? null,
      ...extra,
    },
  });
  createdGroupIds.push(group.id);
  await prisma.groupMember.create({
    data: { groupId: group.id, userId: creator.id, name: creator.name, memberType: "creator" },
  });
  return group;
}

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.group.deleteMany({ where: { id: { in: createdGroupIds } } });
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
});

describe("PDF gate", () => {
  it("refuses strangers and unknown groups", async () => {
    const guide = await makeUser("GUIDE", "pdf-guide");
    const student = await makeUser("STUDENT", "pdf-student");
    const stranger = await makeUser("STUDENT", "pdf-stranger");
    const group = await makeGroup(student, guide);

    await expect(checkPdfGate(stranger, group.id)).rejects.toThrow(/cannot access/);
    await expect(checkPdfGate(student, "missing-group")).rejects.toThrow(/not found/i);
  });

  it("refuses an incomplete group with the missing list", async () => {
    const guide = await makeUser("GUIDE", "pdf-guide");
    const hod = await makeUser("HOD", "pdf-hod");
    const student = await makeUser("STUDENT", "pdf-student");
    const group = await makeGroup(student, guide, { pdfPermission: true });

    for (const actor of [student, guide, hod]) {
      await expect(checkPdfGate(actor, group.id)).rejects.toThrow(/still incomplete/);
    }
    try {
      await checkPdfGate(student, group.id);
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toMatch(/Topic finalization/);
    }
  });

  it("refuses a complete group without HOD permission", async () => {
    const guide = await makeUser("GUIDE", "pdf-guide");
    const hod = await makeUser("HOD", "pdf-hod");
    const student = await makeUser("STUDENT", "pdf-student");
    const group = await makeGroup(student, guide);
    const member = await prisma.groupMember.findFirstOrThrow({ where: { groupId: group.id } });
    const now = new Date();

    await prisma.groupMember.update({
      where: { id: member.id },
      data: {
        name: "Full Member",
        teResult: "Pass",
        rollNo: `R${rid()}`,
        mobile: "9000000000",
        examSeatNo: `S${rid()}`,
        email: `${rid()}@apcoer.edu.in`,
        contribution: "All",
        photoUrl: "/media/x.jpg",
        rulesAckAt: now,
        undertakingAcceptedAt: now,
      },
    });
    await prisma.group.update({
      where: { id: group.id },
      data: {
        department: "Computer Engineering",
        academicYear: "2025-26",
        area: "Testing",
      },
    });
    await prisma.topicProposal.create({
      data: { groupId: group.id, topicNo: 1, title: "T", description: "D", status: "APPROVED" },
    });
    await prisma.activityTemplate.upsert({
      where: { month_sortOrder: { month: "june", sortOrder: 9603 } },
      update: {},
      create: { month: "june", sortOrder: 9603, text: "Vitest PDF row" },
    });
    const allTemplates = await prisma.activityTemplate.findMany({ select: { id: true, month: true } });
    for (const t of allTemplates) {
      await prisma.activityEntry.upsert({
        where: { groupId_templateId: { groupId: group.id, templateId: t.id } },
        update: { status: "GUIDE_VERIFIED", statusText: "COMPLETE" },
        create: {
          groupId: group.id,
          templateId: t.id,
          month: t.month,
          status: "GUIDE_VERIFIED",
          statusText: "COMPLETE",
        },
      });
    }
    await prisma.contentPage.createMany({
      data: [
        { groupId: group.id, type: "RTM", sortOrder: 0, richText: "matrix" },
        { groupId: group.id, type: "COST", sortOrder: 0, richText: "cost" },
      ],
    });
    const templates = await prisma.reviewTemplate.findMany({ select: { id: true } });
    for (const t of templates) {
      await prisma.reviewForm.upsert({
        where: { groupId_templateId: { groupId: group.id, templateId: t.id } },
        update: { status: "APPROVED" },
        create: { groupId: group.id, templateId: t.id, status: "APPROVED" },
      });
    }
    for (const kind of ["MOCK_T1", "FINAL_T2"]) {
      await prisma.marksSheet.upsert({
        where: { groupId_memberId_kind: { groupId: group.id, memberId: member.id, kind } },
        update: { status: "APPROVED", total: 50 },
        create: { groupId: group.id, memberId: member.id, kind, components: "{}", total: 50, status: "APPROVED" },
      });
    }
    for (const term of ["TERM_I", "TERM_II"]) {
      await prisma.examinerFeedback.upsert({
        where: { groupId_term: { groupId: group.id, term } },
        update: { answers: JSON.stringify(Array(9).fill("Good")) },
        create: { groupId: group.id, term, answers: JSON.stringify(Array(9).fill("Good")) },
      });
    }
    await prisma.checklist.createMany({
      data: ["TERM_I", "TERM_II"].map((term) => ({
        groupId: group.id,
        term,
        items: JSON.stringify([{ text: "x", checked: true }]),
      })),
    });
    await prisma.competition.create({ data: { groupId: group.id, name: "Contest" } });
    await prisma.paperPublication.create({ data: { groupId: group.id, title: "Paper" } });

    // still no HOD permission -> refused for everyone entitled
    for (const actor of [student, guide, hod]) {
      await expect(checkPdfGate(actor, group.id)).rejects.toThrow(/not allowed/);
    }

    // HOD allows it (the group is complete) -> the gate opens
    await prisma.group.update({
      where: { id: group.id },
      data: { pdfPermission: true, pdfPermissionBy: hod.id, pdfPermissionAt: now, status: "PDF_ALLOWED" },
    });
    for (const actor of [student, guide, hod]) {
      const gate = await checkPdfGate(actor, group.id);
      expect(gate.completion.complete).toBe(true);
    }

    // cleanup the suite template rows (entries first: templates are shared)
    await prisma.activityEntry.deleteMany({
      where: { groupId: group.id },
    });
    await prisma.activityTemplate.deleteMany({
      where: { month: "june", sortOrder: 9603 },
    });
  });
});
