import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db.js";
import { fromJson, toJson } from "../json.js";
import { ApiDomainError } from "../errors.js";
import {
  EXAMINER_QUESTIONS,
  EXAMINER_RATINGS,
  type ExaminerRating,
} from "../constants.js";
import { notifyIfReadyForPdf } from "./notifications.js";

export type ExaminerActor = { id: string; role: string; name?: string };

export type ExaminerSheet = {
  group: {
    id: string;
    groupNo: string | null;
    status: string;
    guideId: string | null;
  };
  guideName: string | null;
  projectTitle: string;
  date: string;
  answers: (ExaminerRating | null)[];
  remarks: string;
  externalName: string;
  internalName: string | null;
  signedAt: string | null;
};

const ANSWER_COUNT = EXAMINER_QUESTIONS.length;

export const examinerTermSchema = z.enum(["TERM_I", "TERM_II"]);
export type ExaminerTerm = z.infer<typeof examinerTermSchema>;

export const examinerFeedbackSchema = z.object({
  groupId: z.string().min(1),
  term: examinerTermSchema,
  projectTitle: z.string().trim().max(300, "Title is too long").default(""),
  date: z.string().trim().max(60, "Date is too long").default(""),
  answers: z.array(z.enum(EXAMINER_RATINGS)).length(EXAMINER_QUESTIONS.length, "Rate all 9 questions"),
  remarks: z.string().trim().max(2000, "Remarks are too long").default(""),
  externalName: z.string().trim().max(120, "Name is too long").default(""),
});

const EXAMINER_OPEN_STATUSES = ["ACTIVE", "READY_FOR_PDF", "PDF_ALLOWED"];

export function examinerOpen(groupStatus: string): boolean {
  return EXAMINER_OPEN_STATUSES.includes(groupStatus);
}

function emptyAnswers(): (ExaminerRating | null)[] {
  return Array<ExaminerRating | null>(ANSWER_COUNT).fill(null);
}

function parsedAnswers(raw: string): (ExaminerRating | null)[] {
  const parsed = fromJson<unknown>(raw, []);
  if (!Array.isArray(parsed)) return emptyAnswers();
  return Array.from({ length: ANSWER_COUNT }, (_, index) => {
    const value = parsed[index];
    return value === "Excellent" || value === "Good" || value === "Satisfactory"
      ? value
      : null;
  });
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

export async function getExaminerSheet(
  actor: ExaminerActor,
  groupId: string,
  term: string,
): Promise<ExaminerSheet>;
export async function getExaminerSheet(
  groupId: string,
  term: string,
): Promise<ExaminerSheet>;
export async function getExaminerSheet(
  actorOrGroupId: ExaminerActor | string,
  groupIdOrTerm: string,
  maybeTerm?: string,
): Promise<ExaminerSheet> {
  const actor = typeof actorOrGroupId === "string" ? null : actorOrGroupId;
  const groupId = typeof actorOrGroupId === "string" ? actorOrGroupId : groupIdOrTerm;
  const term = typeof actorOrGroupId === "string" ? groupIdOrTerm : maybeTerm!;

  const parsed = examinerTermSchema.safeParse(term);
  if (!parsed.success) throw new ApiDomainError("INVALID_INPUT", "Unknown feedback term", 400);

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
      if (!member) throw new ApiDomainError("FORBIDDEN", "You cannot view another group's feedback", 403);
    } else if (actor.role === "GUIDE" && group.guideId !== actor.id) {
      throw new ApiDomainError("FORBIDDEN", "Only the assigned guide can view this group's feedback", 403);
    } else if (!["STUDENT", "GUIDE", "HOD"].includes(actor.role)) {
      throw new ApiDomainError("FORBIDDEN", "You cannot view examiner feedback", 403);
    }
  }

  const row = await prisma.examinerFeedback.findUnique({
    where: { groupId_term: { groupId, term: parsed.data } },
  });

  return {
    group: {
      id: group.id,
      groupNo: group.groupNo ?? null,
      status: group.status,
      guideId: group.guideId ?? null,
    },
    guideName: group.guide?.name ?? null,
    projectTitle: row?.projectTitle ?? group.projectTitle ?? "",
    date: row?.date ?? "",
    answers: row ? parsedAnswers(row.answers) : emptyAnswers(),
    remarks: row?.remarks ?? "",
    externalName: row?.externalName ?? "",
    internalName: row?.internalName ?? null,
    signedAt: row?.signedAt ? row.signedAt.toISOString() : null,
  };
}

export async function getStudentExaminerGroupId(actor: ExaminerActor): Promise<string | null> {
  const membership = await prisma.groupMember.findFirst({
    where: { userId: actor.id },
    select: { groupId: true },
  });
  return membership?.groupId ?? null;
}

export async function listGuideExaminerGroups(actor: ExaminerActor) {
  if (actor.role !== "GUIDE") {
    throw new ApiDomainError("FORBIDDEN", "Only guides can view assigned feedback groups", 403);
  }
  return prisma.group.findMany({
    where: { guideId: actor.id },
    orderBy: { groupNo: "asc" },
    include: { examinerFeedbacks: { select: { id: true, term: true } } },
  });
}

export async function listExaminerQueue(actor: ExaminerActor) {
  if (actor.role !== "HOD") {
    throw new ApiDomainError("FORBIDDEN", "Only the HOD can view the examiner queue", 403);
  }
  return prisma.group.findMany({
    where: { examinerFeedbacks: { some: {} } },
    orderBy: { updatedAt: "desc" },
    include: {
      guide: { select: { name: true } },
      examinerFeedbacks: { select: { id: true, term: true } },
    },
  });
}

export async function saveExaminerFeedback(actor: ExaminerActor, input: unknown): Promise<void> {
  if (actor.role !== "GUIDE") {
    throw new ApiDomainError("FORBIDDEN", "Only the project guide can record examiner feedback", 403);
  }
  const parsed = examinerFeedbackSchema.safeParse(input);
  if (!parsed.success) {
    throw new ApiDomainError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  const { groupId, term, projectTitle, date, answers, remarks, externalName } = parsed.data;

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { guide: { select: { name: true } } },
  });
  if (!group) throw new ApiDomainError("GROUP_NOT_FOUND", "Group not found", 404);
  if (group.guideId !== actor.id) {
    throw new ApiDomainError("FORBIDDEN", "Only the guide assigned to this group can record its feedback", 403);
  }
  if (group.status === "PDF_GENERATED") {
    throw new ApiDomainError("LOCKED", "The log book is locked after the final PDF is generated", 409);
  }
  if (!examinerOpen(group.status)) {
    throw new ApiDomainError(
      "NOT_ACTIVE",
      "Examiner feedback unlocks once the HOD approves the group and assigns a guide",
      400,
    );
  }

  const guideName = group.guide?.name ?? null;
  const now = new Date();
  const data = {
    projectTitle: projectTitle || group.projectTitle || null,
    date: date || null,
    answers: toJson(answers),
    remarks: remarks || null,
    externalName: externalName || null,
    internalName: guideName,
    signedAt: now,
  };

  const existing = await prisma.examinerFeedback.findUnique({
    where: { groupId_term: { groupId, term } },
  });

  await prisma.$transaction(async (tx) => {
    const saved = existing
      ? await tx.examinerFeedback.update({ where: { id: existing.id }, data })
      : await tx.examinerFeedback.create({ data: { groupId, term, ...data } });
    await logAction(
      {
        userId: actor.id,
        action: "EXAMINER_SAVE",
        entity: "ExaminerFeedback",
        entityId: saved.id,
        before: existing ? { answers: existing.answers } : null,
        after: { term },
      },
      tx,
    );
  });
  await notifyIfReadyForPdf(groupId);
}
