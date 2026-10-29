import { AppError } from "@/lib/errors";
import {
  approveEvalSheets,
  evalOpen,
  getEvaluationSheet,
  getStudentEvalGroupId,
  listEvalQueue,
  listGuideEvalGroups,
  saveEvalSheets,
  submitEvalSheets,
  unlockEvalSheets,
  type EvalActor,
  type EvalRow,
  type EvalSheet,
} from "@/lib/services/evaluation";
import {
  finalApproveSchema,
  finalSaveSchema,
  finalSubmitSchema,
  finalUnlockSchema,
} from "@/lib/validation/final";
import { notifyIfReadyForPdf, onMarksApproved, onMarksUnlocked, onSheetsSubmitted } from "@/lib/services/notifications";
import type { Role } from "@/lib/roles";

/**
 * Term-II Final Evaluation mark sheets (F13, B9, total 100). Thin wrappers
 * over the shared evaluation core fixed to FINAL_T2 — same workflow as the
 * Term-I mock table (guide writes, guide/HOD approves, HOD unlocks).
 */

export type FinalActor = { id: string; role: Role };
export type FinalRow = EvalRow;
export type FinalSheet = EvalSheet;

export function finalOpen(groupStatus: string): boolean {
  return evalOpen(groupStatus);
}

export async function getFinalSheet(groupId: string): Promise<FinalSheet> {
  return getEvaluationSheet(groupId, "FINAL_T2");
}

export async function getStudentFinalGroupId(userId: string): Promise<string | null> {
  return getStudentEvalGroupId(userId);
}

export async function listGuideFinalGroups(guideId: string) {
  return listGuideEvalGroups(guideId, "FINAL_T2");
}

export async function listFinalQueue() {
  return listEvalQueue("FINAL_T2");
}

function toActor(actor: FinalActor): EvalActor {
  return { id: actor.id, role: actor.role };
}

export async function saveFinalSheets(actor: FinalActor, input: unknown): Promise<void> {
  const parsed = finalSaveSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  await saveEvalSheets(toActor(actor), "FINAL_T2", parsed.data);
}

export async function submitFinalSheets(actor: FinalActor, input: unknown): Promise<void> {
  const parsed = finalSubmitSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  await submitEvalSheets(toActor(actor), "FINAL_T2", parsed.data.groupId);
  await onSheetsSubmitted(parsed.data.groupId, "Final Evaluation table");
}

export async function approveFinalSheets(actor: FinalActor, input: unknown): Promise<void> {
  const parsed = finalApproveSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  await approveEvalSheets(toActor(actor), "FINAL_T2", parsed.data.groupId);
  await onMarksApproved(parsed.data.groupId, "Final Evaluation table");
  await notifyIfReadyForPdf(parsed.data.groupId);
}

export async function unlockFinalSheets(actor: FinalActor, input: unknown): Promise<void> {
  const parsed = finalUnlockSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  await unlockEvalSheets(toActor(actor), "FINAL_T2", parsed.data.groupId, parsed.data.reason);
  await onMarksUnlocked(parsed.data.groupId, "Final Evaluation table");
}
