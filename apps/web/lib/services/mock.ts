import "server-only";

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
  type EvalSaveRows,
  type EvalSheet,
} from "@/lib/services/evaluation";
import {
  mockApproveSchema,
  mockSaveSchema,
  mockSubmitSchema,
  mockUnlockSchema,
} from "@/lib/validation/mock";
import { AppError } from "@/lib/errors";
import type { Role } from "@/lib/roles";

export type MockActor = { id: string; role: Role };
export type MockRow = EvalRow;
export type MockSheet = EvalSheet;

export function mockOpen(groupStatus: string): boolean {
  return evalOpen(groupStatus);
}

export function getMockSheet(groupId: string): Promise<MockSheet> {
  return getEvaluationSheet(groupId, "MOCK_T1");
}

export function getStudentMockGroupId(userId?: string): Promise<string | null> {
  return getStudentEvalGroupId(userId);
}

export function listGuideMockGroups(guideId: string) {
  return listGuideEvalGroups(guideId, "MOCK_T1");
}

export function listMockQueue() {
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
  await saveEvalSheets(toActor(actor), "MOCK_T1", parsed.data as EvalSaveRows);
}

export async function submitMockSheets(actor: MockActor, input: unknown): Promise<void> {
  const parsed = mockSubmitSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  await submitEvalSheets(toActor(actor), "MOCK_T1", parsed.data.groupId);
}

export async function approveMockSheets(actor: MockActor, input: unknown): Promise<void> {
  const parsed = mockApproveSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  await approveEvalSheets(toActor(actor), "MOCK_T1", parsed.data.groupId);
}

export async function unlockMockSheets(actor: MockActor, input: unknown): Promise<void> {
  const parsed = mockUnlockSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  await unlockEvalSheets(toActor(actor), "MOCK_T1", parsed.data.groupId, parsed.data.reason);
}
