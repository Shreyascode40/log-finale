"use server";

import { getCurrentUser } from "@/lib/permissions";
import { AppError } from "@/lib/errors";
import {
  deleteMeeting,
  recordExternalSign,
  saveMeeting,
  saveSponsorFeedback,
  signMeetingGuide,
  signMeetingStudent,
  uploadSeal,
  type SponsoredActor,
} from "@/lib/services/sponsored";

/**
 * Server actions for the sponsored project sheets (F14). Students of a
 * sponsored group write the log and feedback; the assigned guide countersigns.
 */

export type SponsoredResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

async function sponsoredActor(): Promise<SponsoredActor> {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in");
  return { id: user.id, role: user.role };
}

function toError(error: unknown): string {
  if (error instanceof AppError) return error.message;
  console.error("sponsored action failed", error);
  return "Something went wrong. Please try again.";
}

async function run<T>(fn: (actor: SponsoredActor) => Promise<T>): Promise<SponsoredResult<T>> {
  try {
    const actor = await sponsoredActor();
    return { success: true, data: await fn(actor) };
  } catch (error) {
    return { success: false, error: toError(error) };
  }
}

export async function saveMeetingAction(input: unknown) {
  return run(async (actor) => saveMeeting(actor, input));
}

export async function deleteMeetingAction(input: unknown) {
  return run(async (actor) => {
    await deleteMeeting(actor, input);
    return undefined;
  });
}

export async function signMeetingStudentAction(input: unknown) {
  return run(async (actor) => signMeetingStudent(actor, input));
}

export async function signMeetingGuideAction(input: unknown) {
  return run(async (actor) => signMeetingGuide(actor, input));
}

export async function recordExternalSignAction(input: unknown) {
  return run(async (actor) => recordExternalSign(actor, input));
}

export async function saveSponsorFeedbackAction(input: unknown) {
  return run(async (actor) => {
    await saveSponsorFeedback(actor, input);
    return undefined;
  });
}

export async function uploadSealAction(formData: FormData): Promise<SponsoredResult<string>> {
  try {
    const actor = await sponsoredActor();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      throw new AppError("INVALID_INPUT", "Choose a seal scan to upload");
    }
    return { success: true, data: await uploadSeal(actor, file) };
  } catch (error) {
    return { success: false, error: toError(error) };
  }
}
