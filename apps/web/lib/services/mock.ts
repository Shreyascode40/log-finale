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
  mockApproveSchema,
  mockSaveSchema,
  mockSubmitSchema,
  mockUnlockSchema,
} from "@/lib/validation/mock";
import { notifyIfReadyForPdf, onMarksApproved, onMarksUnlocked, onSheetsSubmitted } from "@/lib/services/notifications";
import type { Role } from "@/lib/roles";

/**
 * Term-I Mock Evaluation mark sheets (F11, B9). Thin wrappers over the shared
 * evaluation core (`lib/services/evaluation.ts`) fixed to MOCK_T1, so the
 * F11 pages, actions and tests keep working unchanged.
 */

export type MockActor = { id: string; role: Role };
export type MockRow = EvalRow;
export type MockSheet = EvalSheet;

export function mockOpen(groupStatus: string): boolean {
  return evalOpen(groupStatus);
}

export async function getMockSheet(groupId: string): Promise<MockSheet> {
  return getEvaluationSheet(groupId, "MOCK_T1");
}

export async function getStudentMockGroupId(userId: string): Promise<string | null> {
  return getStudentEvalGroupId(userId);
}

export async function listGuideMockGroups(guideId: string) {
  return listGuideEvalGroups(guideId, "MOCK_T1");
}

export async function listMockQueue() {
  return listEvalQueue("MOCK_T1");
}

function toActor(actor: MockActor): EvalActor {
  return { id: actor.id, role: actor.role };
}

export async function saveMockSheets(actor: MockActor, input: unknown): Promise<void> {
  const parsed = mockSaveSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  await saveEvalSheets(toActor(actor), "MOCK_T1", parsed.data);
}

export async function submitMockSheets(actor: MockActor, input: unknown): Promise<void> {
  const parsed = mockSubmitSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  await submitEvalSheets(toActor(actor), "MOCK_T1", parsed.data.groupId);
  await onSheetsSubmitted(parsed.data.groupId, "Mock Evaluation table");
}

export async function approveMockSheets(actor: MockActor, input: unknown): Promise<void> {
  const parsed = mockApproveSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  await approveEvalSheets(toActor(actor), "MOCK_T1", parsed.data.groupId);
  await onMarksApproved(parsed.data.groupId, "Mock Evaluation table");
  await notifyIfReadyForPdf(parsed.data.groupId);
}

export async function unlockMockSheets(actor: MockActor, input: unknown): Promise<void> {
  const parsed = mockUnlockSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  await unlockEvalSheets(toActor(actor), "MOCK_T1", parsed.data.groupId, parsed.data.reason);
  await onMarksUnlocked(parsed.data.groupId, "Mock Evaluation table");
}
