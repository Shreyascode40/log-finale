"use server";

import { getCurrentUser } from "@/lib/permissions";
import { AppError } from "@/lib/errors";
import { signoffSchema } from "@/lib/validation/signoff";
import {
  acceptUndertaking,
  acknowledgeRules,
  type SignoffActor,
} from "@/lib/services/signoff";

/**
 * Server actions for the Rules and Undertaking sheets (F6). A single student
 * handles the whole group, so each action takes the target member's id; the
 * service checks that the member is in the caller's own group.
 */

export type SignoffResult<T> = { success: true; data: T } | { success: false; error: string };

async function studentActor(): Promise<SignoffActor> {
  const user = await getCurrentUser();
  if (!user || user.role !== "STUDENT") {
    throw new AppError("FORBIDDEN", "Only students of the group can sign the log book");
  }
  return { id: user.id, role: "STUDENT" };
}

function parseMemberId(input: unknown): string {
  const parsed = signoffSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Choose a member to sign");
  }
  return parsed.data.memberId;
}

function toError(error: unknown): string {
  if (error instanceof AppError) return error.message;
  console.error("signoff action failed", error);
  return "Something went wrong. Please try again.";
}

export async function acknowledgeRulesAction(
  input: unknown,
): Promise<SignoffResult<{ acknowledgedAt: string }>> {
  try {
    const actor = await studentActor();
    return { success: true, data: await acknowledgeRules(actor, parseMemberId(input)) };
  } catch (error) {
    return { success: false, error: toError(error) };
  }
}

export async function acceptUndertakingAction(
  input: unknown,
): Promise<SignoffResult<{ acceptedAt: string }>> {
  try {
    const actor = await studentActor();
    return { success: true, data: await acceptUndertaking(actor, parseMemberId(input)) };
  } catch (error) {
    return { success: false, error: toError(error) };
  }
}
