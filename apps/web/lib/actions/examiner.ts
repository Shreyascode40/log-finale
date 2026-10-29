"use server";

import { getCurrentUser } from "@/lib/permissions";
import { AppError } from "@/lib/errors";
import { saveExaminerFeedback, type ExaminerActor } from "@/lib/services/examiner";

/** Server actions for External Examiner Feedback (F11). Guide-only writes. */

export type ExaminerResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function saveExaminerFeedbackAction(
  input: unknown,
): Promise<ExaminerResult<undefined>> {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) throw new AppError("UNAUTHENTICATED", "Please sign in");
    const actor: ExaminerActor = { id: sessionUser.id, role: sessionUser.role };
    await saveExaminerFeedback(actor, input);
    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof AppError) return { success: false, error: error.message };
    console.error("examiner action failed", error);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}
