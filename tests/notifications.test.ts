import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import type { Role } from "@/lib/roles";
import { assignGuide } from "@/lib/services/admin";
import { confirmEntry, verifyEntry } from "../apps/api/src/modules/activity-chart";
import { decideTopic, scoreTopic } from "../apps/api/src/modules/topic";
import { approveReview, submitReview, unlockReview } from "@/lib/services/review";
import { listForUser, markAllRead, notifyIfReadyForPdf } from "@/lib/services/notifications";

/**
 * F17 — Notifications. Proves the A6 events land in the right inboxes
 * (in-app rows; email rides EMAIL_PROVIDER=noop here) and the ready-for-PDF
 * fan-out fires exactly once.
 */

type Actor = { id: string; role: Role; name: string };

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
  return { id: user.id, role: user.role as Role, name: user.name };
}

async function makeGroup(creator: Actor, status = "SUBMITTED") {
  const group = await prisma.group.create({
    data: {
      code: `C${rid()}`,
      groupNo: `G${rid()}`,
      projectTitle: "Vitest notify project",
      status,
      creatorId: creator.id,
    },
  });
  createdGroupIds.push(group.id);
  await prisma.groupMember.create({
    data: { groupId: group.id, userId: creator.id, name: creator.name, memberType: "creator" },
  });
  return group;
}

async function inbox(userId: string) {
  return prisma.notification.findMany({ where: { userId }, select: { type: true } });
}

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.auditLog.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.group.deleteMany({ where: { id: { in: createdGroupIds } } });
  for (const templateId of createdTemplateIds) {
    await prisma.activityEntry.deleteMany({ where: { templateId } });
    await prisma.activityTemplate.deleteMany({ where: { id: templateId } });
  }
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
});

describe("assignment and activity events", () => {
  it("notifies students + guide on assignment, guide on confirm, student on verify", async () => {
    const hod = await makeUser("HOD", "n-hod");
    const guide = await makeUser("GUIDE", "n-guide");
    const student = await makeUser("STUDENT", "n-student");
    const group = await makeGroup(student, "SUBMITTED");

    await assignGuide(hod, { groupId: group.id, guideId: guide.id });
    expect((await inbox(student.id)).map((n) => n.type)).toContain("GUIDE_ASSIGNED");
    expect((await inbox(guide.id)).map((n) => n.type)).toContain("GUIDE_ASSIGNED");

    const template = await prisma.activityTemplate.create({
      data: { month: "june", sortOrder: 9701, text: "Vitest notify row" },
    });
    createdTemplateIds.push(template.id);
    await prisma.group.update({ where: { id: group.id }, data: { status: "ACTIVE" } });

    const chart = await prisma.activityEntry.create({
      data: { groupId: group.id, templateId: template.id, month: "june", status: "PLANNED" },
    });
    await confirmEntry(student, { entryId: chart.id, date: "", statusText: "COMPLETE" });
    expect((await inbox(guide.id)).map((n) => n.type)).toContain("ENTRY_CONFIRMED");

    await verifyEntry(guide, { entryId: chart.id });
    expect((await inbox(student.id)).map((n) => n.type)).toContain("ENTRY_VERIFIED");
  });
});

describe("topic and review events", () => {
  it("notifies HOD on score/submit and students + guide on decisions", async () => {
    const hod = await makeUser("HOD", "n-hod");
    const guide = await makeUser("GUIDE", "n-guide");
    const student = await makeUser("STUDENT", "n-student");
    const group = await makeGroup(student, "ACTIVE");
    await prisma.group.update({ where: { id: group.id }, data: { guideId: guide.id } });

    await prisma.topicProposal.create({
      data: { groupId: group.id, topicNo: 1, title: "T", description: "D", status: "SUBMITTED" },
    });
    await scoreTopic(guide, {
      groupId: group.id,
      topicNo: 1,
      significance: 8,
      innovativeness: 8,
      scope: 8,
      feasibility: 8,
      recommendation: "YES",
    });
    expect((await inbox(hod.id)).map((n) => n.type)).toContain("TOPIC_SCORED");

    await decideTopic(hod, { groupId: group.id, topicNo: 1, decision: "APPROVED" });
    expect((await inbox(student.id)).map((n) => n.type)).toContain("TOPIC_DECIDED");

    const template = await prisma.reviewTemplate.upsert({
      where: { reviewType: "REVIEW_I" },
      update: {},
      create: { term: "TERM_I", reviewType: "REVIEW_I", title: "Vitest", order: 1, hasDateColumn: false },
    });
    const question = await prisma.reviewQuestion.upsert({
      where: { templateId_questionNo: { templateId: template.id, questionNo: 1 } },
      update: {},
      create: { templateId: template.id, questionNo: 1, text: "Q" },
    });
    expect(question).toBeDefined();

    await submitReview(guide, { groupId: group.id, reviewType: "REVIEW_I" });
    expect((await inbox(hod.id)).map((n) => n.type)).toContain("REVIEW_SUBMITTED");

    await approveReview(hod, { groupId: group.id, reviewType: "REVIEW_I" });
    expect((await inbox(student.id)).map((n) => n.type)).toContain("MARKS_APPROVED");
    expect((await inbox(guide.id)).map((n) => n.type)).toContain("MARKS_APPROVED");

    await unlockReview(hod, { groupId: group.id, reviewType: "REVIEW_I", reason: "Recheck" });
    expect((await inbox(guide.id)).map((n) => n.type)).toContain("MARKS_UNLOCKED");
  });

  it("marks notifications read", async () => {
    const student = await makeUser("STUDENT", "n-student");
    await makeGroup(student, "ACTIVE");

    await prisma.notification.create({
      data: { userId: student.id, type: "PING", message: "hello" },
    });
    let box = await listForUser(student.id);
    expect(box.unread).toBeGreaterThanOrEqual(1);

    await markAllRead(student.id);
    box = await listForUser(student.id);
    expect(box.unread).toBe(0);
    expect(box.items.length).toBeGreaterThanOrEqual(1);
  });
});

describe("ready-for-PDF fan-out", () => {
  it("notifies HODs exactly once when a group completes", async () => {
    const hod = await makeUser("HOD", "n-hod");
    const guide = await makeUser("GUIDE", "n-guide");
    const student = await makeUser("STUDENT", "n-student");
    const group = await makeGroup(student, "ACTIVE");
    await prisma.group.update({
      where: { id: group.id },
      data: {
        guideId: guide.id,
        department: "Computer Engineering",
        academicYear: "2025-26",
        area: "Testing",
      },
    });
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
    await prisma.topicProposal.create({
      data: { groupId: group.id, topicNo: 1, title: "T", description: "D", status: "APPROVED" },
    });
    const template = await prisma.activityTemplate.create({
      data: { month: "june", sortOrder: 9702, text: "Vitest ready row" },
    });
    createdTemplateIds.push(template.id);
    // every template on record must verify for this group
    const templates = await prisma.activityTemplate.findMany({ select: { id: true, month: true } });
    for (const t of templates) {
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
    const reviewTemplates = await prisma.reviewTemplate.findMany({ select: { id: true } });
    for (const t of reviewTemplates) {
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

    await notifyIfReadyForPdf(group.id);
    await notifyIfReadyForPdf(group.id);
    const ready = await prisma.notification.findMany({
      where: { type: "GROUP_READY", userId: hod.id },
    });
    expect(ready).toHaveLength(1);
    expect(ready[0]?.message).toMatch(/ready for PDF/);
  });
});
