import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { updateScheduleItemSchema } from "@/lib/validation/schedule";
import { SCHEDULE_TERMS, type ScheduleTerm } from "@/lib/constants";
import type { Role } from "@/lib/roles";

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
  const items = await prisma.scheduleItem.findMany({
    orderBy: [{ sortOrder: "asc" }],
  });

  return SCHEDULE_TERMS.map(({ term, label }) => ({
    term,
    label,
    rows: items
      .filter((item) => item.term === term)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item) => ({
        id: item.id,
        sortOrder: item.sortOrder,
        description: item.description,
        date: item.date ?? "",
        note: item.note ?? "",
      })),
  }));
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

  const item = await prisma.scheduleItem.findUnique({ where: { id } });
  if (!item) throw new AppError("NOT_FOUND", "That schedule row does not exist");

  const data = { date: date || null, note: note || null };

  await prisma.$transaction(async (tx) => {
    await tx.scheduleItem.update({ where: { id }, data });
    await logAction(
      {
        userId: actor.id,
        action: "SCHEDULE_UPDATE",
        entity: "ScheduleItem",
        entityId: id,
        before: { date: item.date, note: item.note },
        after: data,
      },
      tx,
    );
  });
}
