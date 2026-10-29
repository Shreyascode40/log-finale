import { AppError } from "@/lib/errors";
import { updateScheduleItemSchema } from "@/lib/validation/schedule";
import type { ScheduleTerm } from "@/lib/constants";
import type { Role } from "@/lib/roles";
import { backendApi } from "@/lib/backend-api";

/**
 * Schedule sheet (F7). The two B5 tables are seeded once; only the HOD edits
 * the date cells and everyone else reads them. The role check runs here on the
 * server — the read-only UI is never the enforcement point.
 */

export type ScheduleActor = { id: string; role: Role };

export type ScheduleRow = {
  id: string;
  sortOrder: number;
  description: string;
  date: string;
  note: string;
};

export type ScheduleTermGroup = {
  term: ScheduleTerm;
  label: string;
  rows: ScheduleRow[];
};

/** Reads the two tables for the viewer. Pages enforce who may open them. */
export async function getSchedule(): Promise<ScheduleTermGroup[]> {
  return backendApi<ScheduleTermGroup[]>("/v1/schedule");
}

function assertEditor(actor: ScheduleActor): void {
  if (actor.role !== "HOD") {
    throw new AppError("FORBIDDEN", "Only the Head of Department can edit the schedule");
  }
}

/** Updates one schedule row's date (and note). HOD only. Audited. */
export async function updateScheduleItem(actor: ScheduleActor, input: unknown): Promise<void> {
  assertEditor(actor);

  const parsed = updateScheduleItemSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { id, date, note } = parsed.data;
  await backendApi(`/v1/schedule/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ date, note }),
  });
}
