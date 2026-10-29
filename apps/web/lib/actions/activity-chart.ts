"use server";

import { getCurrentUser } from "@/lib/permissions";
import { AppError } from "@/lib/errors";
import {
  confirmEntry,
  verifyEntry,
  type ActivityChartActor,
  type ConfirmResult,
  type VerifyResult,
} from "@/lib/services/activity-chart";

/**
 * Server actions for the Activity Chart sheets (F9). Each action re-resolves
 * the caller; the service enforces who may confirm (students of the group) or
 * verify (the assigned guide). The UI never decides access.
 */

export type ActivityChartResult<T> = { success: true; data: T } | { success: false; error: string };

async function chartActor(): Promise<ActivityChartActor> {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in");
  return { id: user.id, role: user.role };
}

function toError(error: unknown): string {
  if (error instanceof AppError) return error.message;
  console.error("activity-chart action failed", error);
  return "Something went wrong. Please try again.";
}

export async function confirmEntryAction(input: unknown): Promise<ActivityChartResult<ConfirmResult>> {
  try {
    return { success: true, data: await confirmEntry(await chartActor(), input) };
  } catch (error) {
    return { success: false, error: toError(error) };
  }
}

export async function verifyEntryAction(input: unknown): Promise<ActivityChartResult<VerifyResult>> {
  try {
    return { success: true, data: await verifyEntry(await chartActor(), input) };
  } catch (error) {
    return { success: false, error: toError(error) };
  }
}
