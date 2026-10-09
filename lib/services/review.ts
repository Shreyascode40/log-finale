import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import {
  reviewApproveSchema,
  reviewDraftSchema,
  reviewSubmitSchema,
  reviewUnlockSchema,
} from "@/lib/validation/review";
import { notifyIfReadyForPdf, onMarksApproved, onMarksUnlocked, onReviewSubmitted } from "@/lib/services/notifications";
import type { Role } from "@/lib/roles";

/**
 * Term-I reviews and the marks workflow (F10):
 *   DRAFT (assigned guide edits remarks/grades) -> SUBMITTED (guide; applies
 *   the guide's per-question sign automatically) -> APPROVED (assigned guide or
 *   HOD, locked). Only the HOD can unlock APPROVED marks with a mandatory
 *   written reason, which returns the form to DRAFT. Every transition audits.
 *
 * Reads and writes are permission-checked here, never in the UI.
 */

export type ReviewActor = { id: string; role: Role };

export type ReviewScoreRow = {
  questionId: string;
  questionNo: number;
  text: string;
  remark: string;
  grade: string;
  date: string;
  signedByName: string | null;
  signedAt: string | null;
};

export type ReviewSheet = {
  group: {
    id: string;
    groupNo: string | null;
    projectTitle: string | null;
    status: string;
    guideId: string | null;
  };
  guideName: string | null;
  template: { reviewType: string; title: string; term: string; hasDateColumn: boolean };
  form: {
    status: string;
    remarkAndSuggestions: string;
    submittedByName: string | null;
    submittedAt: string | null;
    approvedByName: string | null;
    approvedAt: string | null;
    unlockReason: string;
  };
  scores: ReviewScoreRow[];
};

/** Group statuses in which reviews may move (rule 12: ACTIVE). */
const REVIEW_OPEN_STATUSES = ["ACTIVE", "READY_FOR_PDF", "PDF_ALLOWED"];

export function reviewsOpen(groupStatus: string): boolean {
  return REVIEW_OPEN_STATUSES.includes(groupStatus);
}

async function assertReviewOpen(group: { status: string }) {
  if (group.status === "PDF_GENERATED") {
    throw new AppError("LOCKED", "The log book is locked after the final PDF is generated");
  }
  if (!reviewsOpen(group.status)) {
    throw new AppError(
      "NOT_ACTIVE",
      "Reviews unlock once the HOD approves the group and assigns a guide",
    );
  }
}

async function assignedGroup(actor: ReviewActor, groupId: string) {
  if (actor.role !== "GUIDE") {
    throw new AppError("FORBIDDEN", "Only the project guide can write marks");
  }
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw new AppError("GROUP_NOT_FOUND", "Group not found");
  if (group.guideId !== actor.id) {
    throw new AppError("FORBIDDEN", "Only the guide assigned to this group can write its marks");
  }
  return group;
}

/** Materialize the DRAFT form and one empty score row per question. */
async function ensureForm(groupId: string, templateId: string, guideId: string | null) {
  const form = await prisma.reviewForm.upsert({
    where: { groupId_templateId: { groupId, templateId } },
    update: {},
    create: { groupId, templateId, guideId, status: "DRAFT" },
  });
  const questions = await prisma.reviewQuestion.findMany({
    where: { templateId },
    orderBy: { questionNo: "asc" },
    select: { id: true },
  });
  for (const question of questions) {
    await prisma.reviewScore.upsert({
      where: { formId_questionId: { formId: form.id, questionId: question.id } },
      update: {},
      create: { formId: form.id, questionId: question.id },
    });
  }
  return form;
}

/** The full review sheet for a group: template, form, scores and signatures. */
export async function getReviewSheet(groupId: string, reviewType: string): Promise<ReviewSheet> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { guide: { select: { name: true } } },
  });
  if (!group) throw new AppError("GROUP_NOT_FOUND", "Group not found");

  const template = await prisma.reviewTemplate.findUnique({ where: { reviewType } });
  if (!template) throw new AppError("NOT_FOUND", "That review does not exist");

  await ensureForm(groupId, template.id, group.guideId);

  const [form, questions] = await Promise.all([
    prisma.reviewForm.findUniqueOrThrow({
      where: { groupId_templateId: { groupId, templateId: template.id } },
      include: {
        submittedBy: { select: { name: true } },
        approvedBy: { select: { name: true } },
      },
    }),
    prisma.reviewQuestion.findMany({
      where: { templateId: template.id },
      orderBy: { questionNo: "asc" },
      include: { scores: { where: { form: { groupId } }, include: { signedBy: { select: { name: true } } } } },
    }),
  ]);

  return {
    group: {
      id: group.id,
      groupNo: group.groupNo ?? null,
      projectTitle: group.projectTitle ?? null,
      status: group.status,
      guideId: group.guideId ?? null,
    },
    guideName: group.guide?.name ?? null,
    template: { reviewType: template.reviewType, title: template.title, term: template.term, hasDateColumn: template.hasDateColumn },
    form: {
      status: form.status,
      remarkAndSuggestions: form.remarkAndSuggestions ?? "",
      submittedByName: form.submittedBy?.name ?? null,
      submittedAt: form.submittedAt ? form.submittedAt.toISOString() : null,
      approvedByName: form.approvedBy?.name ?? null,
      approvedAt: form.approvedAt ? form.approvedAt.toISOString() : null,
      unlockReason: form.unlockReason ?? "",
    },
    scores: questions.map((question) => {
      const score = question.scores[0];
      return {
        questionId: question.id,
        questionNo: question.questionNo,
        text: question.text,
        remark: score?.remark ?? "",
        grade: score?.grade ?? "",
        date: score?.date ?? "",
        signedByName: score?.signedBy?.name ?? null,
        signedAt: score?.guideSignedAt ? score.guideSignedAt.toISOString() : null,
      };
    }),
  };
}

/** Review templates with this group's form status, for the student index. */
export async function listGroupReviewStatuses(groupId: string) {
  const templates = await prisma.reviewTemplate.findMany({ orderBy: [{ term: "asc" }, { order: "asc" }] });
  const forms = await prisma.reviewForm.findMany({ where: { groupId } });
  const statusByTemplate = new Map(forms.map((form) => [form.templateId, form.status]));
  return templates.map((template) => ({
    reviewType: template.reviewType,
    title: template.title,
    term: template.term,
    status: statusByTemplate.get(template.id) ?? "DRAFT",
  }));
}

/** The single group a student belongs to (reviews are read-only for them). */
export async function getStudentReviewGroupId(userId: string): Promise<string | null> {
  const membership = await prisma.groupMember.findFirst({
    where: { userId },
    select: { groupId: true },
  });
  return membership?.groupId ?? null;
}

/** Assigned groups with their review forms, for the guide index. */
export async function listGuideReviewGroups(guideId: string) {
  return prisma.group.findMany({
    where: { guideId },
    orderBy: { groupNo: "asc" },
    include: {
      reviewForms: {
        include: { template: { select: { reviewType: true, title: true } } },
      },
    },
  });
}

/** Every group that has at least one review form, for the HOD queue. */
export async function listReviewQueue() {
  return prisma.group.findMany({
    where: { reviewForms: { some: {} } },
    orderBy: { updatedAt: "desc" },
    include: {
      guide: { select: { name: true } },
      reviewForms: {
        include: { template: { select: { reviewType: true, title: true } } },
      },
    },
  });
}

export async function saveReviewDraft(actor: ReviewActor, input: unknown): Promise<void> {
  const parsed = reviewDraftSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { groupId, reviewType, remarkAndSuggestions, scores } = parsed.data;

  const group = await assignedGroup(actor, groupId);
  await assertReviewOpen(group);

  const template = await prisma.reviewTemplate.findUnique({ where: { reviewType } });
  if (!template) throw new AppError("NOT_FOUND", "That review does not exist");
  const form = await ensureForm(groupId, template.id, actor.id);
  if (form.status !== "DRAFT") {
    throw new AppError("INVALID_STATE", "Only a draft review can be edited");
  }

  const questionIds = new Set(
    (await prisma.reviewQuestion.findMany({ where: { templateId: template.id }, select: { id: true } })).map(
      (question) => question.id,
    ),
  );
  for (const score of scores) {
    if (!questionIds.has(score.questionId)) {
      throw new AppError("INVALID_INPUT", "That question does not belong to this review");
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const score of scores) {
      await tx.reviewScore.update({
        where: { formId_questionId: { formId: form.id, questionId: score.questionId } },
        data: {
          remark: score.remark || null,
          grade: score.grade || null,
          // Per-row dates exist only on the Term-II coding / validation /
          // report sheets; other templates keep the column empty.
          date: template.hasDateColumn ? score.date || null : null,
        },
      });
    }
    await tx.reviewForm.update({
      where: { id: form.id },
      data: { remarkAndSuggestions: remarkAndSuggestions || null, guideId: actor.id },
    });
    await logAction(
      {
        userId: actor.id,
        action: "REVIEW_SAVE",
        entity: "ReviewForm",
        entityId: form.id,
        before: { status: form.status },
        after: { status: "DRAFT", scores: scores.length },
      },
      tx,
    );
  });
}

export async function submitReview(actor: ReviewActor, input: unknown): Promise<void> {
  const parsed = reviewSubmitSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { groupId, reviewType } = parsed.data;

  const group = await assignedGroup(actor, groupId);
  await assertReviewOpen(group);

  const template = await prisma.reviewTemplate.findUnique({ where: { reviewType } });
  if (!template) throw new AppError("NOT_FOUND", "That review does not exist");
  const form = await ensureForm(groupId, template.id, actor.id);
  if (form.status !== "DRAFT") {
    throw new AppError("INVALID_STATE", "Only a draft review can be submitted");
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    // Submitting applies the guide's per-question sign automatically (rule 3).
    await tx.reviewScore.updateMany({
      where: { formId: form.id },
      data: { guideSignedById: actor.id, guideSignedAt: now },
    });
    await tx.reviewForm.update({
      where: { id: form.id },
      data: { status: "SUBMITTED", submittedById: actor.id, submittedAt: now, guideId: actor.id },
    });
    await logAction(
      {
        userId: actor.id,
        action: "REVIEW_SUBMIT",
        entity: "ReviewForm",
        entityId: form.id,
        before: { status: "DRAFT" },
        after: { status: "SUBMITTED" },
      },
      tx,
    );
  });
  await onReviewSubmitted(groupId, template.title);
}

export async function approveReview(actor: ReviewActor, input: unknown): Promise<void> {
  const parsed = reviewApproveSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { groupId, reviewType } = parsed.data;

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw new AppError("GROUP_NOT_FOUND", "Group not found");
  const isAssignedGuide = actor.role === "GUIDE" && group.guideId === actor.id;
  if (!isAssignedGuide && actor.role !== "HOD") {
    throw new AppError("FORBIDDEN", "Only the assigned guide or the HOD can approve marks");
  }
  await assertReviewOpen(group);

  const template = await prisma.reviewTemplate.findUnique({ where: { reviewType } });
  if (!template) throw new AppError("NOT_FOUND", "That review does not exist");
  const form = await ensureForm(groupId, template.id, group.guideId);
  if (form.status !== "SUBMITTED") {
    throw new AppError("INVALID_STATE", "Only a submitted review can be approved");
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.reviewForm.update({
      where: { id: form.id },
      data: { status: "APPROVED", approvedById: actor.id, approvedAt: now },
    });
    await logAction(
      {
        userId: actor.id,
        action: "REVIEW_APPROVE",
        entity: "ReviewForm",
        entityId: form.id,
        before: { status: "SUBMITTED" },
        after: { status: "APPROVED" },
      },
      tx,
    );
  });
  await onMarksApproved(groupId, template.title);
  await notifyIfReadyForPdf(groupId);
}

export async function unlockReview(actor: ReviewActor, input: unknown): Promise<void> {
  if (actor.role !== "HOD") {
    throw new AppError("FORBIDDEN", "Only the Head of Department can unlock approved marks");
  }
  const parsed = reviewUnlockSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { groupId, reviewType, reason } = parsed.data;

  const template = await prisma.reviewTemplate.findUnique({ where: { reviewType } });
  if (!template) throw new AppError("NOT_FOUND", "That review does not exist");
  const form = await prisma.reviewForm.findUnique({
    where: { groupId_templateId: { groupId, templateId: template.id } },
  });
  if (!form) throw new AppError("NOT_FOUND", "That review does not exist");
  if (form.status !== "APPROVED") {
    throw new AppError("INVALID_STATE", "Only approved marks can be unlocked");
  }
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw new AppError("GROUP_NOT_FOUND", "Group not found");
  if (group.status === "PDF_GENERATED") {
    throw new AppError("LOCKED", "The log book is locked after the final PDF is generated");
  }

  await prisma.$transaction(async (tx) => {
    await tx.reviewForm.update({
      where: { id: form.id },
      data: {
        status: "DRAFT",
        submittedById: null,
        submittedAt: null,
        approvedById: null,
        approvedAt: null,
        unlockReason: reason,
      },
    });
    await logAction(
      {
        userId: actor.id,
        action: "REVIEW_UNLOCK",
        entity: "ReviewForm",
        entityId: form.id,
        before: { status: "APPROVED" },
        after: { status: "DRAFT", unlockReason: reason },
      },
      tx,
    );
  });
  await onMarksUnlocked(groupId, template.title);
}
