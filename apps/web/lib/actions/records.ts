"use server";

import { getCurrentUser } from "@/lib/permissions";
import { AppError } from "@/lib/errors";
import {
  deleteCompetition,
  deleteNote,
  deletePaper,
  saveCompetition,
  saveContent,
  saveNote,
  savePaper,
  setChecklist,
  uploadCertificate,
  uploadContentFile,
  uploadPaperFile,
  type RecordsActor,
} from "@/lib/services/records";

/**
 * Server actions for the independent records (F12). Each action re-resolves
 * the caller; the service only lets students of the group write.
 */

export type RecordsResult<T = undefined> = { success: true; data: T } | { success: false; error: string };

async function recordsActor(): Promise<RecordsActor> {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in");
  return { id: user.id, role: user.role };
}

function toError(error: unknown): string {
  if (error instanceof AppError) return error.message;
  console.error("records action failed", error);
  return "Something went wrong. Please try again.";
}

async function run<T>(fn: (actor: RecordsActor) => Promise<T>): Promise<RecordsResult<T>> {
  try {
    const actor = await recordsActor();
    return { success: true, data: await fn(actor) };
  } catch (error) {
    return { success: false, error: toError(error) };
  }
}

function fileFrom(formData: FormData): File {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new AppError("INVALID_INPUT", "Choose a file to upload");
  }
  return file;
}

export async function saveCompetitionAction(input: unknown) {
  return run(async (actor) => saveCompetition(actor, input));
}

export async function deleteCompetitionAction(input: unknown) {
  return run(async (actor) => {
    await deleteCompetition(actor, input);
    return undefined;
  });
}

export async function uploadCertificateAction(formData: FormData): Promise<RecordsResult<string>> {
  try {
    const actor = await recordsActor();
    const url = await uploadCertificate(actor, fileFrom(formData), String(formData.get("id") ?? ""));
    return { success: true, data: url };
  } catch (error) {
    return { success: false, error: toError(error) };
  }
}

export async function savePaperAction(input: unknown) {
  return run(async (actor) => savePaper(actor, input));
}

export async function deletePaperAction(input: unknown) {
  return run(async (actor) => {
    await deletePaper(actor, input);
    return undefined;
  });
}

export async function uploadPaperFileAction(formData: FormData): Promise<RecordsResult<string>> {
  try {
    const actor = await recordsActor();
    const url = await uploadPaperFile(actor, fileFrom(formData), String(formData.get("id") ?? ""));
    return { success: true, data: url };
  } catch (error) {
    return { success: false, error: toError(error) };
  }
}

export async function setChecklistAction(input: unknown) {
  return run(async (actor) => {
    await setChecklist(actor, input);
    return undefined;
  });
}

export async function saveContentAction(input: unknown) {
  return run(async (actor) => {
    await saveContent(actor, input);
    return undefined;
  });
}

export async function uploadContentFileAction(formData: FormData): Promise<RecordsResult<string>> {
  try {
    const actor = await recordsActor();
    const type = String(formData.get("type") ?? "");
    if (type !== "RTM" && type !== "COST") throw new AppError("INVALID_INPUT", "Unknown page");
    const url = await uploadContentFile(actor, fileFrom(formData), type);
    return { success: true, data: url };
  } catch (error) {
    return { success: false, error: toError(error) };
  }
}

export async function saveNoteAction(input: unknown) {
  return run(async (actor) => saveNote(actor, input));
}

export async function deleteNoteAction(input: unknown) {
  return run(async (actor) => {
    await deleteNote(actor, input);
    return undefined;
  });
}
