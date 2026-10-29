"use server";

import { getCurrentUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import {
  acceptInvite,
  createGroup,
  declineInvite,
  inviteMember,
  joinByCode,
  removeMember,
  submitGroup,
  type GroupActor,
} from "@/lib/services/group";

/**
 * Server actions for student group onboarding (F4). Role and membership rules
 * are re-checked inside the service layer; these wrappers only resolve the
 * caller and shape the `{ success, data?, error? }` result.
 */

export type GroupResult<T = undefined> = { success: true; data: T } | { success: false; error: string };

async function studentActor(): Promise<GroupActor> {
  const user = await getCurrentUser();
  if (!user || user.role !== "STUDENT") {
    throw new AppError("FORBIDDEN", "Only students can manage groups");
  }
  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { rollNo: true } });
  return { id: user.id, role: "STUDENT", email: user.email, rollNo: row?.rollNo ?? null };
}

function toError(error: unknown): string {
  if (error instanceof AppError) return error.message;
  console.error("group action failed", error);
  return "Something went wrong. Please try again.";
}

async function run<T>(fn: (actor: GroupActor) => Promise<T>): Promise<GroupResult<T>> {
  try {
    const actor = await studentActor();
    return { success: true, data: await fn(actor) };
  } catch (error) {
    return { success: false, error: toError(error) };
  }
}

export async function createGroupAction(input: unknown) {
  return run((actor) => createGroup(actor, input));
}

export async function inviteMemberAction(input: unknown) {
  return run((actor) => inviteMember(actor, input));
}

export async function acceptInviteAction(input: unknown) {
  return run((actor) => acceptInvite(actor, input));
}

export async function declineInviteAction(input: unknown) {
  return run(async (actor) => {
    await declineInvite(actor, input);
    return undefined;
  });
}

export async function joinByCodeAction(input: unknown) {
  return run((actor) => joinByCode(actor, input));
}

export async function removeMemberAction(input: unknown) {
  return run(async (actor) => {
    await removeMember(actor, input);
    return undefined;
  });
}

export async function submitGroupAction(input: unknown) {
  return run(async (actor) => {
    await submitGroup(actor, input);
    return undefined;
  });
}
