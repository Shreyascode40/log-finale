"use server";

import { getCurrentUser } from "@/lib/permissions";
import { AppError } from "@/lib/errors";
import { decideTopic, saveTopic, scoreTopic, type TopicActor } from "@/lib/services/topic";

/**
 * Server actions for the Topic Finalization sheets (F8). Each action re-resolves
 * the caller; the service enforces who may write (students, the assigned guide
 * or the HOD). The UI never decides access.
 */

export type TopicResult<T = undefined> = { success: true; data: T } | { success: false; error: string };

async function topicActor(): Promise<TopicActor> {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in");
  return { id: user.id, role: user.role };
}

function toError(error: unknown): string {
  if (error instanceof AppError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  console.error("topic action failed", error);
  return "Something went wrong. Please try again.";
}

async function run<T>(fn: (actor: TopicActor) => Promise<T>): Promise<TopicResult<T>> {
  try {
    const actor = await topicActor();
    return { success: true, data: await fn(actor) };
  } catch (error) {
    return { success: false, error: toError(error) };
  }
}

export async function saveTopicAction(input: unknown) {
  return run(async (actor) => {
    await saveTopic(actor, input);
    return undefined;
  });
}

export async function scoreTopicAction(input: unknown) {
  return run(async (actor) => {
    await scoreTopic(actor, input);
    return undefined;
  });
}

export async function decideTopicAction(input: unknown) {
  return run(async (actor) => {
    await decideTopic(actor, input);
    return undefined;
  });
}
