import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db.js";
import { toJson } from "../json.js";
import { ApiDomainError } from "../errors.js";
import { ALL_REVIEW_TYPES } from "../constants.js";
import {
  notifyIfReadyForPdf,
  onMarksApproved,
  onMarksUnlocked,
  onReviewSubmitted,
} from "./notifications.js";

export type ReviewActor = { id: string; role: string; name?: string };

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

const remark = z.string().trim().max(1000, "Remark is too long").default("");
const grade = z.string().trim().max(20, "Grade is too long").default("");
const rowDate = z.string().trim().max(60, "Date is too long").default("");

const reviewDraftSchema = z.object({
  groupId: z.string().min(1),
  reviewType: z.enum(ALL_REVIEW_TYPES),
  remarkAndSuggestions: z.string().trim().max(2000, "Remark and Suggestions is too long").default(""),
  scores: z
    .array(
      z.object({
        questionId: z.string().min(1),
        remark,
        grade,
        date: rowDate,
      }),
    )
    .max(50),
});

const reviewSubmitSchema = z.object({
  groupId: z.string().min(1),
  reviewType: z.enum(ALL_REVIEW_TYPES),
});

const reviewApproveSchema = z.object({
  groupId: z.string().min(1),
  reviewType: z.enum(ALL_REVIEW_TYPES),
});

const reviewUnlockSchema = z
  .object({
    groupId: z.string().min(1),
    reviewType: z.enum(ALL_REVIEW_TYPES),
    reason: z.string().trim().max(300, "Reason is too long").default(""),
  })
  .refine((value) => value.reason.length > 0, {
    message: "A reason is required to unlock approved marks",
    path: ["reason"],
  });

const REVIEW_OPEN_STATUSES = ["ACTIVE", "READY_FOR_PDF", "PDF_ALLOWED"];

export function reviewsOpen(groupStatus: string): boolean {
  return REVIEW_OPEN_STATUSES.includes(groupStatus);
}

function assertReviewOpen(group: { status: string }) {
  if (group.status === "PDF_GENERATED") {
    throw new ApiDomainError("LOCKED", "The log book is locked after the final PDF is generated", 409);
  }
  if (!reviewsOpen(group.status)) {
    throw new ApiDomainError(
      "NOT_ACTIVE",
      "Reviews unlock once the HOD approves the group and assigns a guide",
      400,
    );
  }
}

async function assignedGroup(actor: ReviewActor, groupId: string) {
  if (actor.role !== "GUIDE") {
    throw new ApiDomainError("FORBIDDEN", "Only the project guide can write marks", 403);
  }
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw new ApiDomainError("GROUP_NOT_FOUND", "Group not found", 404);
  if (group.guideId !== actor.id) {
    throw new ApiDomainError("FORBIDDEN", "Only the guide assigned to this group can write its marks", 403);
  }
  return group;
}

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

async function logAction(
  input: { userId: string; action: string; entity: string; entityId: string; before?: unknown; after?: unknown },
  tx: Prisma.TransactionClient,
) {
  await tx.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      before: input.before === undefined ? null : toJson(input.before),
      after: input.after === undefined ? null : toJson(input.after),
    },
  });
}

export async function getReviewSheet(
  actor: ReviewActor,
  groupId: string,
  reviewType: string,
): Promise<ReviewSheet>;
export async function getReviewSheet(
  groupId: string,
  reviewType: string,
): Promise<ReviewSheet>;
export async function getReviewSheet(
  actorOrGroupId: ReviewActor | string,
  groupIdOrReviewType: string,
  maybeReviewType?: string,
): Promise<ReviewSheet> {
  const actor = typeof actorOrGroupId === "string" ? null : actorOrGroupId;
  const groupId = typeof actorOrGroupId === "string" ? actorOrGroupId : groupIdOrReviewType;
  const reviewType = typeof actorOrGroupId === "string" ? groupIdOrReviewType : maybeReviewType!;

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { guide: { select: { name: true } } },
  });
  if (!group) throw new ApiDomainError("GROUP_NOT_FOUND", "Group not found", 404);

  if (actor) {
    if (actor.role === "STUDENT") {
      const member = await prisma.groupMember.findFirst({
        where: { groupId, userId: actor.id },
        select: { id: true },
      });
      if (!member) throw new ApiDomainError("FORBIDDEN", "You cannot view another group's reviews", 403);
    } else if (actor.role === "GUIDE" && group.guideId !== actor.id) {
      throw new ApiDomainError("FORBIDDEN", "Only the assigned guide can view this group's reviews", 403);
    } else if (!["STUDENT", "GUIDE", "HOD"].includes(actor.role)) {
      throw new ApiDomainError("FORBIDDEN", "You cannot view review sheets", 403);
    }
  }

  const template = await prisma.reviewTemplate.findUnique({ where: { reviewType } });
  if (!template) throw new ApiDomainError("NOT_FOUND", "That review does not exist", 404);

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
      include: {
        scores: {
          where: { form: { groupId } },
          include: { signedBy: { select: { name: true } } },
        },
      },
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
    template: {
      reviewType: template.reviewType,
      title: template.title,
      term: template.term,
      hasDateColumn: template.hasDateColumn,
    },
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

export async function listGroupReviewStatuses(
  actor: ReviewActor | null | undefined,
  groupId: string,
) {
  if (actor && actor.role === "STUDENT") {
    const member = await prisma.groupMember.findFirst({
      where: { groupId, userId: actor.id },
      select: { id: true },
    });
    if (!member) throw new ApiDomainError("FORBIDDEN", "You cannot view another group's reviews", 403);
  }
  const templates = await prisma.reviewTemplate.findMany({
    orderBy: [{ term: "asc" }, { order: "asc" }],
  });
  const forms = await prisma.reviewForm.findMany({ where: { groupId } });
  const statusByTemplate = new Map(forms.map((form) => [form.templateId, form.status]));
  return templates.map((template) => ({
    reviewType: template.reviewType,
    title: template.title,
    term: template.term,
    status: statusByTemplate.get(template.id) ?? "DRAFT",
  }));
}

export async function getStudentReviewGroupId(actor: ReviewActor): Promise<string | null> {
  const membership = await prisma.groupMember.findFirst({
    where: { userId: actor.id },
    select: { groupId: true },
  });
  return membership?.groupId ?? null;
}

export async function listGuideReviewGroups(actor: ReviewActor) {
  if (actor.role !== "GUIDE") {
    throw new ApiDomainError("FORBIDDEN", "Only guides can view assigned review groups", 403);
  }
  return prisma.group.findMany({
    where: { guideId: actor.id },
    orderBy: { groupNo: "asc" },
    include: {
      reviewForms: {
        include: { template: { select: { reviewType: true, title: true } } },
      },
    },
  });
}

export async function listReviewQueue(actor: ReviewActor) {
  if (actor.role !== "HOD") {
    throw new ApiDomainError("FORBIDDEN", "Only the HOD can view the review queue", 403);
  }
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
    throw new ApiDomainError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  const { groupId, reviewType, remarkAndSuggestions, scores } = parsed.data;

  const group = await assignedGroup(actor, groupId);
  assertReviewOpen(group);

  const template = await prisma.reviewTemplate.findUnique({ where: { reviewType } });
  if (!template) throw new ApiDomainError("NOT_FOUND", "That review does not exist", 404);
  const form = await ensureForm(groupId, template.id, actor.id);
  if (form.status !== "DRAFT") {
    throw new ApiDomainError("INVALID_STATE", "Only a draft review can be edited", 409);
  }

  const questionIds = new Set(
    (
      await prisma.reviewQuestion.findMany({
        where: { templateId: template.id },
        select: { id: true },
      })
    ).map((question) => question.id),
  );
  for (const score of scores) {
    if (!questionIds.has(score.questionId)) {
      throw new ApiDomainError("INVALID_INPUT", "That question does not belong to this review", 400);
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const score of scores) {
      await tx.reviewScore.update({
        where: { formId_questionId: { formId: form.id, questionId: score.questionId } },
        data: {
          remark: score.remark || null,
          grade: score.grade || null,
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
    throw new ApiDomainError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  const { groupId, reviewType } = parsed.data;

  const group = await assignedGroup(actor, groupId);
  assertReviewOpen(group);

  const template = await prisma.reviewTemplate.findUnique({ where: { reviewType } });
  if (!template) throw new ApiDomainError("NOT_FOUND", "That review does not exist", 404);
  const form = await ensureForm(groupId, template.id, actor.id);
  if (form.status !== "DRAFT") {
    throw new ApiDomainError("INVALID_STATE", "Only a draft review can be submitted", 409);
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
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
    throw new ApiDomainError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  const { groupId, reviewType } = parsed.data;

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw new ApiDomainError("GROUP_NOT_FOUND", "Group not found", 404);
  const isAssignedGuide = actor.role === "GUIDE" && group.guideId === actor.id;
  if (!isAssignedGuide && actor.role !== "HOD") {
    throw new ApiDomainError("FORBIDDEN", "Only the assigned guide or the HOD can approve marks", 403);
  }
  assertReviewOpen(group);

  const template = await prisma.reviewTemplate.findUnique({ where: { reviewType } });
  if (!template) throw new ApiDomainError("NOT_FOUND", "That review does not exist", 404);
  const form = await ensureForm(groupId, template.id, group.guideId);
  if (form.status !== "SUBMITTED") {
    throw new ApiDomainError("INVALID_STATE", "Only a submitted review can be approved", 409);
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
    throw new ApiDomainError("FORBIDDEN", "Only the Head of Department can unlock approved marks", 403);
  }
  const parsed = reviewUnlockSchema.safeParse(input);
  if (!parsed.success) {
    throw new ApiDomainError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  const { groupId, reviewType, reason } = parsed.data;

  const template = await prisma.reviewTemplate.findUnique({ where: { reviewType } });
  if (!template) throw new ApiDomainError("NOT_FOUND", "That review does not exist", 404);
  const form = await prisma.reviewForm.findUnique({
    where: { groupId_templateId: { groupId, templateId: template.id } },
  });
  if (!form) throw new ApiDomainError("NOT_FOUND", "That review does not exist", 404);
  if (form.status !== "APPROVED") {
    throw new ApiDomainError("INVALID_STATE", "Only approved marks can be unlocked", 409);
  }
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw new ApiDomainError("GROUP_NOT_FOUND", "Group not found", 404);
  if (group.status === "PDF_GENERATED") {
    throw new ApiDomainError("LOCKED", "The log book is locked after the final PDF is generated", 409);
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
