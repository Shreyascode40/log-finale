"use server";

import { canEditSchedule, getCurrentUser } from "@/lib/permissions";
import { AppError } from "@/lib/errors";
import { updateScheduleItem } from "@/lib/services/schedule";

/**
 * Server action for the Schedule sheet (F7). Re-resolves the current user and
 * re-checks on the server that they are a guide (reviewer) or the HOD before
 * touching the database.
 */

export type ScheduleResult<T = undefined> = { success: true; data: T } | { success: false; error: string };

export async function updateScheduleItemAction(input: unknown): Promise<ScheduleResult<undefined>> {
  try {
    const user = await getCurrentUser();
    if (!user || !canEditSchedule(user)) {
      throw new AppError("FORBIDDEN", "Only a guide or the Head of Department can edit the schedule");
    }
    await updateScheduleItem({ id: user.id, role: user.role }, input);
    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof AppError) return { success: false, error: error.message };
    console.error("schedule action failed", error);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}
