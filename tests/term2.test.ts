import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import type { Role } from "@/lib/roles";
import { getReviewSheet, saveReviewDraft, submitReview } from "../apps/api/src/modules/review";
import {
  approveFinalSheets,
  getFinalSheet,
  saveFinalSheets,
  submitFinalSheets,
  unlockFinalSheets,
} from "../apps/api/src/modules/evaluation";
import { getExaminerSheet, saveExaminerFeedback } from "../apps/api/src/modules/examiner";

/**
 * F13 — Term-II reviews (with per-row dates), Final Evaluation (100) and
 * Examiner Feedback Term-II. Proves the reused workflows on the new Term-II
 * data, against the throwaway test database.
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

async function makeGroup(creator: Actor, guide: Actor | null, status = "ACTIVE") {
  const group = await prisma.group.create({
    data: {
      code: `C${rid()}`,
      groupNo: `G${rid()}`,
      projectTitle: "Vitest Term-II project",
      status,
      creatorId: creator.id,
      guideId: guide?.id ?? null,
    },
  });
  createdGroupIds.push(group.id);
  await prisma.groupMember.create({
    data: { groupId: group.id, userId: creator.id, name: creator.name, memberType: "creator" },
  });
  return group;
}

async function ensureTerm2Template() {
  const template = await prisma.reviewTemplate.upsert({
    where: { reviewType: "REVIEW_II_CODING" },
    update: { hasDateColumn: true },
    create: {
      term: "TERM_II",
      reviewType: "REVIEW_II_CODING",
      title: "Vitest Coding Review",
      order: 5,
      hasDateColumn: true,
    },
  });
  const count = await prisma.reviewQuestion.count({ where: { templateId: template.id } });
  if (count === 0) {
    await prisma.reviewQuestion.createMany({
      data: [1, 2].map((questionNo) => ({
        templateId: template.id,
        questionNo,
        text: `Vitest coding question ${questionNo}`,
      })),
    });
  }
  return template;
}

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.group.deleteMany({ where: { id: { in: createdGroupIds } } });
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
});

describe("Term-II review with per-row dates", () => {
  it("saves dates per question and carries them through submit", async () => {
    const guide = await makeUser("GUIDE", "t2-guide");
    const student = await makeUser("STUDENT", "t2-student");
    const group = await makeGroup(student, guide);
    await ensureTerm2Template();

    const sheet = await getReviewSheet(group.id, "REVIEW_II_CODING");
    expect(sheet.template.hasDateColumn).toBe(true);
    const ids = sheet.scores.map((score) => score.questionId);

    await saveReviewDraft(guide, {
      groupId: group.id,
      reviewType: "REVIEW_II_CODING",
      remarkAndSuggestions: "",
      scores: [
        { questionId: ids[0]!, remark: "Clean", grade: "8", date: "12 Jan 2026" },
        { questionId: ids[1]!, remark: "", grade: "", date: "" },
      ],
    });

    await submitReview(guide, { groupId: group.id, reviewType: "REVIEW_II_CODING" });
    const submitted = await getReviewSheet(group.id, "REVIEW_II_CODING");
    expect(submitted.form.status).toBe("SUBMITTED");
    expect(submitted.scores[0]?.date).toBe("12 Jan 2026");
    expect(submitted.scores[1]?.date).toBe("");
  });
});

describe("Final Evaluation (100)", () => {
  it("totals to 100 and enforces the 40-mark coding max", async () => {
    const guide = await makeUser("GUIDE", "t2-guide");
    const student = await makeUser("STUDENT", "t2-student");
    const group = await makeGroup(student, guide);

    const sheet = await getFinalSheet(group.id);
    const memberId = sheet.rows[0]?.memberId;
    if (!memberId) throw new Error("no final rows materialized");

    await expect(
      saveFinalSheets(guide, {
        groupId: group.id,
        rows: [{ memberId, components: { coding: 41 } }],
      }),
    ).rejects.toThrow(/above 40/);

    await saveFinalSheets(guide, {
      groupId: group.id,
      rows: [
        {
          memberId,
          components: {
            modeling: 10,
            coding: 40,
            testing: 10,
            understanding: 10,
            teamwork: 10,
            demo: 10,
            documents: 10,
          },
        },
      ],
    });
    const saved = await getFinalSheet(group.id);
    expect(saved.rows[0]?.total).toBe(100);
  });

  it("runs the full workflow with HOD unlock", async () => {
    const guide = await makeUser("GUIDE", "t2-guide");
    const hod = await makeUser("HOD", "t2-hod");
    const student = await makeUser("STUDENT", "t2-student");
    const group = await makeGroup(student, guide);

    const sheet = await getFinalSheet(group.id);
    const memberId = sheet.rows[0]?.memberId;
    if (!memberId) throw new Error("no final rows materialized");

    await saveFinalSheets(guide, {
      groupId: group.id,
      rows: [{ memberId, components: { coding: 30 } }],
    });
    await submitFinalSheets(guide, { groupId: group.id });
    await approveFinalSheets(hod, { groupId: group.id });

    let current = await getFinalSheet(group.id);
    expect(current.rows[0]?.status).toBe("APPROVED");

    await expect(
      saveFinalSheets(guide, { groupId: group.id, rows: [{ memberId, components: {} }] }),
    ).rejects.toThrow(/Only draft/);

    await unlockFinalSheets(hod, { groupId: group.id, reason: "Recheck demo" });
    current = await getFinalSheet(group.id);
    expect(current.rows[0]?.status).toBe("DRAFT");

    const row = await prisma.marksSheet.findFirstOrThrow({
      where: { groupId: group.id, memberId, kind: "FINAL_T2" },
    });
    for (const action of ["FINAL_SAVE", "FINAL_SUBMIT", "FINAL_APPROVE", "FINAL_UNLOCK"]) {
      expect(
        await prisma.auditLog.findFirst({ where: { action, entityId: row.id } }),
      ).not.toBeNull();
    }
  });
});

describe("Examiner Feedback Term-II", () => {
  it("records the second term independently of the first", async () => {
    const guide = await makeUser("GUIDE", "t2-guide");
    const student = await makeUser("STUDENT", "t2-student");
    const group = await makeGroup(student, guide);
    const answers = Array<string>(9).fill("Good");

    await saveExaminerFeedback(guide, {
      groupId: group.id,
      term: "TERM_II",
      projectTitle: "",
      date: "20 May 2026",
      answers: [...answers],
      remarks: "Strong finish",
      externalName: "Dr. External Two",
    });

    const termII = await getExaminerSheet(group.id, "TERM_II");
    expect(termII.date).toBe("20 May 2026");
    expect(termII.remarks).toBe("Strong finish");

    const termI = await getExaminerSheet(group.id, "TERM_I");
    expect(termI.signedAt).toBeNull();
  });
});
