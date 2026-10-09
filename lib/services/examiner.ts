import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { fromJson, toJson } from "@/lib/json";
import { EXAMINER_QUESTIONS, type ExaminerRating } from "@/lib/constants";
import { examinerFeedbackSchema, examinerTermSchema } from "@/lib/validation/examiner";
import { notifyIfReadyForPdf } from "@/lib/services/notifications";
import type { Role } from "@/lib/roles";

/**
 * External Examiner Feedback (F11 covers Term-I; Term-II reuses it in F13).
 * The assigned guide transcribes the external examiner's Excellent / Good /
 * Satisfactory ratings per question; students and the HOD see it read-only.
 * Saved feedback counts as complete (SPEC.md A5) — there is no workflow.
 */

export type ExaminerActor = { id: string; role: Role };

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

/** Group statuses in which feedback may be recorded (rule 12: ACTIVE). */
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

/** The Term-I (or Term-II) feedback sheet for a group. */
export async function getExaminerSheet(groupId: string, term: string): Promise<ExaminerSheet> {
  const parsed = examinerTermSchema.safeParse(term);
  if (!parsed.success) throw new AppError("INVALID_INPUT", "Unknown feedback term");

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { guide: { select: { name: true } } },
  });
  if (!group) throw new AppError("GROUP_NOT_FOUND", "Group not found");

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

/** The single group a student belongs to (feedback is read-only for them). */
export async function getStudentExaminerGroupId(userId: string): Promise<string | null> {
  const membership = await prisma.groupMember.findFirst({
    where: { userId },
    select: { groupId: true },
  });
  return membership?.groupId ?? null;
}

/** Assigned groups with their feedback rows, for the guide index. */
export async function listGuideExaminerGroups(guideId: string) {
  return prisma.group.findMany({
    where: { guideId },
    orderBy: { groupNo: "asc" },
    include: { examinerFeedbacks: { select: { id: true, term: true } } },
  });
}

/** Every group that has feedback saved, for the HOD index. */
export async function listExaminerQueue() {
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
    throw new AppError("FORBIDDEN", "Only the project guide can record examiner feedback");
  }
  const parsed = examinerFeedbackSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { groupId, term, projectTitle, date, answers, remarks, externalName } = parsed.data;

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { guide: { select: { name: true } } },
  });
  if (!group) throw new AppError("GROUP_NOT_FOUND", "Group not found");
  if (group.guideId !== actor.id) {
    throw new AppError("FORBIDDEN", "Only the guide assigned to this group can record its feedback");
  }
  if (group.status === "PDF_GENERATED") {
    throw new AppError("LOCKED", "The log book is locked after the final PDF is generated");
  }
  if (!examinerOpen(group.status)) {
    throw new AppError(
      "NOT_ACTIVE",
      "Examiner feedback unlocks once the HOD approves the group and assigns a guide",
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
