"use server";

import { getCurrentUser } from "@/lib/permissions";
import { AppError } from "@/lib/errors";
import {
  updateCover,
  updateMember,
  updateMemberPhoto,
  type GroupInfoActor,
} from "@/lib/services/group-info";

/**
 * Server actions for the Cover and Group Information sheets (F5). Each call
 * re-resolves the caller and re-checks membership in the service layer.
 */

export type GroupInfoResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

async function studentActor(): Promise<GroupInfoActor> {
  const user = await getCurrentUser();
  if (!user || user.role !== "STUDENT") {
    throw new AppError("FORBIDDEN", "Only students of the group can edit the log book");
  }
  return { id: user.id, role: "STUDENT" };
}

function toError(error: unknown): string {
  if (error instanceof AppError) return error.message;
  console.error("group-info action failed", error);
  return "Something went wrong. Please try again.";
}

async function run<T>(fn: (actor: GroupInfoActor) => Promise<T>): Promise<GroupInfoResult<T>> {
  try {
    const actor = await studentActor();
    return { success: true, data: await fn(actor) };
  } catch (error) {
    return { success: false, error: toError(error) };
  }
}

export async function updateCoverAction(input: unknown) {
  return run(async (actor) => {
    await updateCover(actor, input);
    return undefined;
  });
}

export async function updateMemberAction(input: unknown) {
  return run(async (actor) => {
    await updateMember(actor, input);
    return undefined;
  });
}

export async function uploadMemberPhotoAction(formData: FormData): Promise<GroupInfoResult<{ url: string }>> {
  try {
    const actor = await studentActor();
    const file = formData.get("file");
    const memberId = String(formData.get("memberId") ?? "");
    if (!(file instanceof File)) {
      throw new AppError("INVALID_INPUT", "Choose a photo to upload");
    }
    return { success: true, data: await updateMemberPhoto(actor, memberId, file) };
  } catch (error) {
    return { success: false, error: toError(error) };
  }
}
