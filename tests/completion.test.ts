import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import type { Role } from "@/lib/roles";
import { getGroupCompletion } from "../apps/api/src/completion/index";
import { setPdfPermission } from "@/lib/services/admin";

/**
 * F15 — Completion engine. Proves section math on a fresh group, full
 * completion at 100%, and the PDF permission gate, against the throwaway
 * test database.
 */

type Actor = { id: string; role: Role };

const createdEmails: string[] = [];
const createdUserIds: string[] = [];
const createdGroupIds: string[] = [];
const createdTemplateIds: string[] = [];

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
  return { id: user.id, role: user.role as Role };
}

async function makeGroup(creator: Actor, guide: Actor | null, status = "ACTIVE") {
  const group = await prisma.group.create({
    data: {
      code: `C${rid()}`,
      groupNo: `G${rid()}`,
      projectTitle: "Vitest completion project",
      area: "Testing",
      academicYear: "2025-26",
      department: "Computer Engineering",
      status,
      creatorId: creator.id,
      guideId: guide?.id ?? null,
    },
  });
  createdGroupIds.push(group.id);
  await prisma.groupMember.create({
    data: {
      groupId: group.id,
      userId: creator.id,
      name: "Full Member",
      teResult: "Pass",
      rollNo: `R${rid()}`,
      mobile: "9000000000",
      examSeatNo: `S${rid()}`,
      email: creator.id,
      contribution: "Everything",
      photoUrl: "/media/x.jpg",
      memberType: "creator",
    },
  });
  return group;
}

async function makeTemplate(month: string, sortOrder: number) {
  const template = await prisma.activityTemplate.upsert({
    where: { month_sortOrder: { month, sortOrder } },
    update: { text: `Vitest completion row ${rid()}` },
    create: { month, sortOrder, text: `Vitest completion row ${rid()}` },
  });
  if (!createdTemplateIds.includes(template.id)) createdTemplateIds.push(template.id);
  return template;
}

/** Verified-COMPLETE entries for every template the suite currently holds. */
async function verifyAllTemplates(groupId: string, byId: string) {
  const templates = await prisma.activityTemplate.findMany({ select: { id: true, month: true } });
  const now = new Date();
  for (const template of templates) {
    await prisma.activityEntry.upsert({
      where: { groupId_templateId: { groupId, templateId: template.id } },
      update: {
        status: "GUIDE_VERIFIED",
        statusText: "COMPLETE",
        studentConfirmedAt: now,
        studentConfirmedById: byId,
        guideVerifiedAt: now,
      },
      create: {
        groupId,
        templateId: template.id,
        month: template.month,
        status: "GUIDE_VERIFIED",
        statusText: "COMPLETE",
        studentConfirmedAt: now,
        studentConfirmedById: byId,
        guideVerifiedAt: now,
      },
    });
  }
}

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.group.deleteMany({ where: { id: { in: createdGroupIds } } });
  for (const templateId of createdTemplateIds) {
    await prisma.activityEntry.deleteMany({ where: { templateId } });
    await prisma.activityTemplate.deleteMany({ where: { id: templateId } });
  }
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
});

describe("completion math", () => {
  it("starts at 0 with everything missing", async () => {
    const guide = await makeUser("GUIDE", "f-guide");
    const student = await makeUser("STUDENT", "f-student");
    const group = await makeGroup(student, guide);

    const completion = await getGroupCompletion(group.id);
    expect(completion.complete).toBe(false);
    expect(completion.missing.length).toBeGreaterThan(0);
    expect(completion.percent).toBeLessThan(20);

    const cover = completion.sections.find((s) => s.key === "cover")!;
    expect(cover.complete).toBe(true);
    const members = completion.sections.find((s) => s.key === "members")!;
    expect(members.complete).toBe(true);
    const topics = completion.sections.find((s) => s.key === "topics")!;
    expect(topics.complete).toBe(false);
  });

  it("reaches 100 percent when every section is done", async () => {
    const hod = await makeUser("HOD", "f-hod");
    const guide = await makeUser("GUIDE", "f-guide");
    const student = await makeUser("STUDENT", "f-student");
    const group = await makeGroup(student, guide);
    const member = await prisma.groupMember.findFirstOrThrow({ where: { groupId: group.id } });
    expect(hod).toBeDefined();

    // rules + undertaking
    const now = new Date();
    await prisma.groupMember.update({
      where: { id: member.id },
      data: { rulesAckAt: now, undertakingAcceptedAt: now },
    });
    // approved topic
    await prisma.topicProposal.create({
      data: { groupId: group.id, topicNo: 1, title: "T", description: "D", status: "APPROVED" },
    });
    // one verified-complete activity row (the suite owns its template)
    await makeTemplate("june", 9601);
    await verifyAllTemplates(group.id, student.id);
    // RTM + cost present
    await prisma.contentPage.createMany({
      data: [
        { groupId: group.id, type: "RTM", sortOrder: 0, richText: "matrix" },
        { groupId: group.id, type: "COST", sortOrder: 0, fileUrl: "/media/cost.pdf" },
      ],
    });
    // every review template approved (whatever the suite currently holds)
    const templates = await prisma.reviewTemplate.findMany({ select: { id: true } });
    for (const t of templates) {
      await prisma.reviewForm.upsert({
        where: { groupId_templateId: { groupId: group.id, templateId: t.id } },
        update: { status: "APPROVED" },
        create: { groupId: group.id, templateId: t.id, status: "APPROVED" },
      });
    }
    // mock + final approved for the member
    for (const kind of ["MOCK_T1", "FINAL_T2"]) {
      await prisma.marksSheet.upsert({
        where: { groupId_memberId_kind: { groupId: group.id, memberId: member.id, kind } },
        update: { status: "APPROVED", total: 50 },
        create: { groupId: group.id, memberId: member.id, kind, components: "{}", total: 50, status: "APPROVED" },
      });
    }
    // both examiner feedbacks saved
    for (const term of ["TERM_I", "TERM_II"]) {
      await prisma.examinerFeedback.upsert({
        where: { groupId_term: { groupId: group.id, term } },
        update: { answers: JSON.stringify(Array(9).fill("Good")) },
        create: { groupId: group.id, term, answers: JSON.stringify(Array(9).fill("Good")) },
      });
    }
    // both checklists fully ticked
    await prisma.checklist.createMany({
      data: ["TERM_I", "TERM_II"].map((term) => ({
        groupId: group.id,
        term,
        items: JSON.stringify([{ text: "x", checked: true }]),
      })),
    });
    // competition + paper
    await prisma.competition.create({ data: { groupId: group.id, name: "Contest" } });
    await prisma.paperPublication.create({ data: { groupId: group.id, title: "Paper" } });

    const completion = await getGroupCompletion(group.id);
    expect(completion.missing).toEqual([]);
    expect(completion.complete).toBe(true);
    expect(completion.percent).toBe(100);
  });
});

describe("PDF permission gate", () => {
  it("refuses an incomplete group and allows a complete one", async () => {
    const hod = await makeUser("HOD", "f-hod");
    const guide = await makeUser("GUIDE", "f-guide");
    const student = await makeUser("STUDENT", "f-student");
    const group = await makeGroup(student, guide);

    await expect(setPdfPermission(hod, { groupId: group.id, allowed: true })).rejects.toThrow(
      /still incomplete/,
    );
    await expect(
      setPdfPermission(student, { groupId: group.id, allowed: true }),
    ).rejects.toThrow(/Head of Department/);

    let current = await prisma.group.findUniqueOrThrow({ where: { id: group.id } });
    expect(current.pdfPermission).toBe(false);
    expect(current.status).toBe("ACTIVE");
  });

  it("moves a complete group to PDF_ALLOWED and revokes back to READY_FOR_PDF", async () => {
    const hod = await makeUser("HOD", "f-hod");
    const guide = await makeUser("GUIDE", "f-guide");
    const student = await makeUser("STUDENT", "f-student");
    const group = await makeGroup(student, guide);
    const member = await prisma.groupMember.findFirstOrThrow({ where: { groupId: group.id } });

    const now = new Date();
    await prisma.groupMember.update({
      where: { id: member.id },
      data: { rulesAckAt: now, undertakingAcceptedAt: now },
    });
    await prisma.topicProposal.create({
      data: { groupId: group.id, topicNo: 1, title: "T", description: "D", status: "APPROVED" },
    });
    const template = await makeTemplate("june", 9602);
    expect(template).toBeDefined();
    await verifyAllTemplates(group.id, student.id);
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

    await setPdfPermission(hod, { groupId: group.id, allowed: true });
    let current = await prisma.group.findUniqueOrThrow({ where: { id: group.id } });
    expect(current.pdfPermission).toBe(true);
    expect(current.status).toBe("PDF_ALLOWED");

    await setPdfPermission(hod, { groupId: group.id, allowed: false });
    current = await prisma.group.findUniqueOrThrow({ where: { id: group.id } });
    expect(current.pdfPermission).toBe(false);
    expect(current.status).toBe("READY_FOR_PDF");

    const audit = await prisma.auditLog.findFirst({
      where: { action: "GROUP_PDF_ALLOW", entityId: group.id },
    });
    expect(audit?.userId).toBe(hod.id);
  });
});
