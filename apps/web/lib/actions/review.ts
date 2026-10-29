"use server";

import { getCurrentUser } from "@/lib/permissions";
import { AppError } from "@/lib/errors";
import {
  approveReview,
  saveReviewDraft,
  submitReview,
  unlockReview,
  type ReviewActor,
} from "@/lib/services/review";

/**
 * Server actions for the Term-I review sheets (F10). Each action re-resolves
 * the caller; the service enforces the marks workflow (guide writes, guide or
 * HOD approves, HOD unlocks with a reason). The UI never decides access.
 */

export type ReviewResult<T = undefined> = { success: true; data: T } | { success: false; error: string };

async function reviewActor(): Promise<ReviewActor> {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in");
  return { id: user.id, role: user.role };
}

function toError(error: unknown): string {
  if (error instanceof AppError) return error.message;
  console.error("review action failed", error);
  return "Something went wrong. Please try again.";
}

async function run<T>(fn: (actor: ReviewActor) => Promise<T>): Promise<ReviewResult<T>> {
  try {
    const actor = await reviewActor();
    return { success: true, data: await fn(actor) };
  } catch (error) {
    return { success: false, error: toError(error) };
  }
}

export async function saveReviewDraftAction(input: unknown) {
  return run(async (actor) => {
    await saveReviewDraft(actor, input);
    return undefined;
  });
}

export async function submitReviewAction(input: unknown) {
  return run(async (actor) => {
    await submitReview(actor, input);
    return undefined;
  });
}

export async function approveReviewAction(input: unknown) {
  return run(async (actor) => {
    await approveReview(actor, input);
    return undefined;
  });
}

export async function unlockReviewAction(input: unknown) {
  return run(async (actor) => {
    await unlockReview(actor, input);
    return undefined;
  });
}
