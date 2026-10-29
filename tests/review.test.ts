import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import type { Role } from "@/lib/roles";
import {
  approveReview,
  getReviewSheet,
  saveReviewDraft,
  submitReview,
  unlockReview,
} from "../apps/api/src/modules/review";

/**
 * F10 — Term-I reviews and the marks workflow. Proves the guide-only writes,
 * the submit-signs-everything rule, the approval lock and the HOD-only unlock
 * with a mandatory reason, against the throwaway test database.
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
      projectTitle: "Vitest review project",
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

async function ensureTemplate() {
  const template = await prisma.reviewTemplate.upsert({
    where: { reviewType: "REVIEW_I" },
    update: {},
    create: {
      term: "TERM_I",
      reviewType: "REVIEW_I",
      title: "Vitest Review I",
      order: 1,
      hasDateColumn: false,
    },
  });
  const existing = await prisma.reviewQuestion.findFirst({ where: { templateId: template.id } });
  if (!existing) {
    await prisma.reviewQuestion.createMany({
      data: [1, 2].map((questionNo) => ({
        templateId: template.id,
        questionNo,
        text: `Vitest question ${questionNo}`,
      })),
    });
  }
  return template;
}

async function questionIds(groupId: string): Promise<string[]> {
  const sheet = await getReviewSheet(groupId, "REVIEW_I");
  return sheet.scores.map((score) => score.questionId);
}

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.group.deleteMany({ where: { id: { in: createdGroupIds } } });
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
});

describe("review drafts are guide-only", () => {
  it("lets the assigned guide save remarks and grades", async () => {
    const guide = await makeUser("GUIDE", "r-guide");
    const student = await makeUser("STUDENT", "r-student");
    const group = await makeGroup(student, guide);
    await ensureTemplate();

    const ids = await questionIds(group.id);
    await saveReviewDraft(guide, {
      groupId: group.id,
      reviewType: "REVIEW_I",
      remarkAndSuggestions: "Work harder on the objectives",
      scores: [{ questionId: ids[0]!, remark: "Good", grade: "8" }],
    });

    const sheet = await getReviewSheet(group.id, "REVIEW_I");
    expect(sheet.form.status).toBe("DRAFT");
    expect(sheet.form.remarkAndSuggestions).toBe("Work harder on the objectives");
    expect(sheet.scores[0]?.remark).toBe("Good");
    expect(sheet.scores[0]?.grade).toBe("8");
  });

  it("refuses students, the HOD and guides of other groups", async () => {
    const guide = await makeUser("GUIDE", "r-guide");
    const otherGuide = await makeUser("GUIDE", "r-guide2");
    const hod = await makeUser("HOD", "r-hod");
    const student = await makeUser("STUDENT", "r-student");
    const group = await makeGroup(student, guide);
    await ensureTemplate();
    const input = { groupId: group.id, reviewType: "REVIEW_I" as const, remarkAndSuggestions: "", scores: [] };

    await expect(saveReviewDraft(student, input)).rejects.toThrow(/Only the project guide/);
    await expect(saveReviewDraft(hod, input)).rejects.toThrow(/Only the project guide/);
    await expect(saveReviewDraft(otherGuide, input)).rejects.toThrow(
      /guide assigned to this group/,
    );
  });
});

describe("submit signs every question and locks editing", () => {
  it("signs all rows and refuses further draft edits", async () => {
    const guide = await makeUser("GUIDE", "r-guide");
    const student = await makeUser("STUDENT", "r-student");
    const group = await makeGroup(student, guide);
    await ensureTemplate();
    const ids = await questionIds(group.id);

    await saveReviewDraft(guide, {
      groupId: group.id,
      reviewType: "REVIEW_I",
      remarkAndSuggestions: "",
      scores: [{ questionId: ids[0]!, remark: "Fine", grade: "7" }],
    });
    await submitReview(guide, { groupId: group.id, reviewType: "REVIEW_I" });

    const sheet = await getReviewSheet(group.id, "REVIEW_I");
    expect(sheet.form.status).toBe("SUBMITTED");
    expect(sheet.form.submittedByName).toBe(guide.name);
    // every question carries the guide's automatic sign, even untouched rows
    expect(sheet.scores.length).toBeGreaterThan(0);
    for (const row of sheet.scores) {
      expect(row.signedByName).toBe(guide.name);
      expect(row.signedAt).not.toBeNull();
    }

    await expect(
      saveReviewDraft(guide, {
        groupId: group.id,
        reviewType: "REVIEW_I",
        remarkAndSuggestions: "",
        scores: [],
      }),
    ).rejects.toThrow(/Only a draft review can be edited/);
  });
});

describe("approval locks the marks", () => {
  it("lets the assigned guide or the HOD approve, then refuses edits", async () => {
    const guide = await makeUser("GUIDE", "r-guide");
    const hod = await makeUser("HOD", "r-hod");
    const student = await makeUser("STUDENT", "r-student");
    const group = await makeGroup(student, guide);
    await ensureTemplate();

    await submitReview(guide, { groupId: group.id, reviewType: "REVIEW_I" });
    await approveReview(hod, { groupId: group.id, reviewType: "REVIEW_I" });

    const sheet = await getReviewSheet(group.id, "REVIEW_I");
    expect(sheet.form.status).toBe("APPROVED");
    expect(sheet.form.approvedByName).toBe(hod.name);

    await expect(
      approveReview(hod, { groupId: group.id, reviewType: "REVIEW_I" }),
    ).rejects.toThrow(/Only a submitted review can be approved/);
  });

  it("refuses students, other guides and approving a draft", async () => {
    const guide = await makeUser("GUIDE", "r-guide");
    const otherGuide = await makeUser("GUIDE", "r-guide2");
    const hod = await makeUser("HOD", "r-hod");
    const student = await makeUser("STUDENT", "r-student");
    const group = await makeGroup(student, guide);
    await ensureTemplate();
    const input = { groupId: group.id, reviewType: "REVIEW_I" as const };

    await expect(approveReview(student, input)).rejects.toThrow(/assigned guide or the HOD/);
    await expect(approveReview(otherGuide, input)).rejects.toThrow(/assigned guide or the HOD/);
    await expect(approveReview(guide, input)).rejects.toThrow(/Only a submitted review/);
    await expect(approveReview(hod, input)).rejects.toThrow(/Only a submitted review/);
  });
});

describe("only the HOD unlocks, with a mandatory reason", () => {
  it("returns approved marks to draft and audits the reason", async () => {
    const guide = await makeUser("GUIDE", "r-guide");
    const hod = await makeUser("HOD", "r-hod");
    const student = await makeUser("STUDENT", "r-student");
    const group = await makeGroup(student, guide);
    await ensureTemplate();

    await submitReview(guide, { groupId: group.id, reviewType: "REVIEW_I" });
    await approveReview(guide, { groupId: group.id, reviewType: "REVIEW_I" });

    await expect(
      unlockReview(guide, { groupId: group.id, reviewType: "REVIEW_I", reason: "fix" }),
    ).rejects.toThrow(/Only the Head of Department/);
    await expect(
      unlockReview(hod, { groupId: group.id, reviewType: "REVIEW_I", reason: "" }),
    ).rejects.toThrow(/reason is required/i);

    await unlockReview(hod, {
      groupId: group.id,
      reviewType: "REVIEW_I",
      reason: "Recheck question 2",
    });

    const sheet = await getReviewSheet(group.id, "REVIEW_I");
    expect(sheet.form.status).toBe("DRAFT");
    expect(sheet.form.unlockReason).toBe("Recheck question 2");

    // the guide can edit the draft again after an unlock
    const ids = await questionIds(group.id);
    await saveReviewDraft(guide, {
      groupId: group.id,
      reviewType: "REVIEW_I",
      remarkAndSuggestions: "",
      scores: [{ questionId: ids[0]!, remark: "Revised", grade: "9" }],
    });
    const revised = await getReviewSheet(group.id, "REVIEW_I");
    expect(revised.scores[0]?.remark).toBe("Revised");
  });

  it("audits every workflow transition", async () => {
    const guide = await makeUser("GUIDE", "r-guide");
    const hod = await makeUser("HOD", "r-hod");
    const student = await makeUser("STUDENT", "r-student");
    const group = await makeGroup(student, guide);
    await ensureTemplate();

    await saveReviewDraft(guide, {
      groupId: group.id,
      reviewType: "REVIEW_I",
      remarkAndSuggestions: "",
      scores: [],
    });
    await submitReview(guide, { groupId: group.id, reviewType: "REVIEW_I" });
    await approveReview(hod, { groupId: group.id, reviewType: "REVIEW_I" });

    const sheet = await getReviewSheet(group.id, "REVIEW_I");
    const formId = (
      await prisma.reviewForm.findFirstOrThrow({
        where: { groupId: group.id, template: { reviewType: "REVIEW_I" } },
      })
    ).id;
    expect(sheet.form.status).toBe("APPROVED");

    for (const action of ["REVIEW_SAVE", "REVIEW_SUBMIT", "REVIEW_APPROVE"]) {
      const audit = await prisma.auditLog.findFirst({ where: { action, entityId: formId } });
      expect(audit).not.toBeNull();
    }
  });
});
