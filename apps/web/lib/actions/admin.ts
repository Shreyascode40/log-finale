"use server";

import { getCurrentUser, type CurrentUser } from "@/lib/permissions";
import { AppError } from "@/lib/errors";
import {
  approveGroup,
  assignGuide,
  createGuide,
  rejectGroup,
  setGroupSponsored,
  setPdfPermission,
  setUserActive,
  updateGuide,
} from "@/lib/services/admin";

/**
 * Server actions for the HOD admin area (F3). Each one re-resolves the current
 * user and re-checks the HOD role on the server; failures come back as
 * `{ success: false, error }`.
 */

export type AdminResult<T = undefined> = { success: true; data: T } | { success: false; error: string };

async function hodActor(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || user.role !== "HOD") {
    throw new AppError("FORBIDDEN", "Only the Head of Department can do this");
  }
  return user;
}

function toError(error: unknown): string {
  if (error instanceof AppError) return error.message;
  console.error("admin action failed", error);
  return "Something went wrong. Please try again.";
}

async function run<T>(fn: (actor: CurrentUser) => Promise<T>): Promise<AdminResult<T>> {
  try {
    const actor = await hodActor();
    const data = await fn(actor);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: toError(error) };
  }
}

export async function createGuideAction(input: unknown) {
  return run(async (actor) => createGuide(actor, input));
}

export async function updateGuideAction(input: unknown) {
  return run(async (actor) => {
    await updateGuide(actor, input);
    return undefined;
  });
}

export async function setUserActiveAction(input: unknown) {
  return run(async (actor) => {
    await setUserActive(actor, input);
    return undefined;
  });
}

export async function approveGroupAction(input: unknown) {
  return run(async (actor) => approveGroup(actor, input));
}

export async function rejectGroupAction(input: unknown) {
  return run(async (actor) => {
    await rejectGroup(actor, input);
    return undefined;
  });
}

export async function assignGuideAction(input: unknown) {
  return run(async (actor) => {
    await assignGuide(actor, input);
    return undefined;
  });
}

export async function setGroupSponsoredAction(input: unknown) {
  return run(async (actor) => {
    await setGroupSponsored(actor, input);
    return undefined;
  });
}

export async function setPdfPermissionAction(input: unknown) {
  return run(async (actor) => {
    await setPdfPermission(actor, input);
    return undefined;
  });
}
