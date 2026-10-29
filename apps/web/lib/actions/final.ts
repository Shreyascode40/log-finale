"use server";

import { getCurrentUser } from "@/lib/permissions";
import { AppError } from "@/lib/errors";
import {
  approveFinalSheets,
  saveFinalSheets,
  submitFinalSheets,
  unlockFinalSheets,
  type FinalActor,
} from "@/lib/services/final";

/**
 * Server actions for the Term-II Final Evaluation table (F13). Same
 * permissions as the mock table: guide-only writes, guide/HOD approval,
 * HOD-only unlocks.
 */

export type FinalResult<T = undefined> = { success: true; data: T } | { success: false; error: string };

async function finalActor(): Promise<FinalActor> {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in");
  return { id: user.id, role: user.role };
}

function toError(error: unknown): string {
  if (error instanceof AppError) return error.message;
  console.error("final action failed", error);
  return "Something went wrong. Please try again.";
}

async function run<T>(fn: (actor: FinalActor) => Promise<T>): Promise<FinalResult<T>> {
  try {
    const actor = await finalActor();
    return { success: true, data: await fn(actor) };
  } catch (error) {
    return { success: false, error: toError(error) };
  }
}

export async function saveFinalSheetsAction(input: unknown) {
  return run(async (actor) => {
    await saveFinalSheets(actor, input);
    return undefined;
  });
}

export async function submitFinalSheetsAction(input: unknown) {
  return run(async (actor) => {
    await submitFinalSheets(actor, input);
    return undefined;
  });
}

export async function approveFinalSheetsAction(input: unknown) {
  return run(async (actor) => {
    await approveFinalSheets(actor, input);
    return undefined;
  });
}

export async function unlockFinalSheetsAction(input: unknown) {
  return run(async (actor) => {
    await unlockFinalSheets(actor, input);
    return undefined;
  });
}
