"use server";

import { getCurrentUser } from "@/lib/permissions";
import { AppError } from "@/lib/errors";
import {
  approveMockSheets,
  saveMockSheets,
  submitMockSheets,
  unlockMockSheets,
  type MockActor,
} from "@/lib/services/mock";

/**
 * Server actions for the Term-I Mock Evaluation table (F11). Each action
 * re-resolves the caller; the service enforces guide-only writes, guide/HOD
 * approval and HOD-only unlocks.
 */

export type MockResult<T = undefined> = { success: true; data: T } | { success: false; error: string };

async function mockActor(): Promise<MockActor> {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in");
  return { id: user.id, role: user.role };
}

function toError(error: unknown): string {
  if (error instanceof AppError) return error.message;
  console.error("mock action failed", error);
  return "Something went wrong. Please try again.";
}

async function run<T>(fn: (actor: MockActor) => Promise<T>): Promise<MockResult<T>> {
  try {
    const actor = await mockActor();
    return { success: true, data: await fn(actor) };
  } catch (error) {
    return { success: false, error: toError(error) };
  }
}

export async function saveMockSheetsAction(input: unknown) {
  return run(async (actor) => {
    await saveMockSheets(actor, input);
    return undefined;
  });
}

export async function submitMockSheetsAction(input: unknown) {
  return run(async (actor) => {
    await submitMockSheets(actor, input);
    return undefined;
  });
}

export async function approveMockSheetsAction(input: unknown) {
  return run(async (actor) => {
    await approveMockSheets(actor, input);
    return undefined;
  });
}

export async function unlockMockSheetsAction(input: unknown) {
  return run(async (actor) => {
    await unlockMockSheets(actor, input);
    return undefined;
  });
}
