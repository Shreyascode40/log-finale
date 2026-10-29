import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { toJson } from "@/lib/json";
import { ACTIVITY_MONTHS, type ActivityMonth } from "@/lib/constants";
import { confirmEntrySchema, verifyEntrySchema } from "@/lib/validation/activity-chart";
import { notifyIfReadyForPdf, onEntryConfirmed, onEntryVerified } from "@/lib/services/notifications";
import type { Role } from "@/lib/roles";

/**
 * Activity charts (F9). One `ActivityEntry` per group per seeded template:
 *   student confirms a row (date + Complete/Incomplete) -> the assigned guide
 *   (reviewer) verifies it. Editing a guide-verified row resets it to
 *   STUDENT_CONFIRMED, clears the guide countersign and keeps a history row,
 *   so a fresh verification is required (master prompt rule 7).
 *
 * Reads and writes are permission-checked here, never in the UI.
 */

export type ActivityChartActor = { id: string; role: Role };

export type ChartSign = { name: string | null; at: string | null };

export type ChartEntry = {
  id: string;
  sortOrder: number;
  text: string;
  date: string;
  status: string;
  statusText: "COMPLETE" | "INCOMPLETE" | null;
  studentSign: ChartSign | null;
  guideSign: ChartSign | null;
};

export type MonthChart = {
  group: {
    id: string;
    groupNo: string | null;
    status: string;
    guideId: string | null;
  };
  guideName: string | null;
  month: ActivityMonth;
  entries: ChartEntry[];
};

/** Group statuses in which charts may be confirmed or verified (rule 12: ACTIVE). */
const CHART_OPEN_STATUSES = ["ACTIVE", "READY_FOR_PDF", "PDF_ALLOWED"];

export function chartsOpen(groupStatus: string): boolean {
  return CHART_OPEN_STATUSES.includes(groupStatus);
}

export function isChartMonth(value: string): value is ActivityMonth {
  return (ACTIVITY_MONTHS as readonly string[]).includes(value);
}

/** Materialize one PLANNED entry per template for groups opening the month. */
async function ensureMonthEntries(groupId: string, month: ActivityMonth): Promise<void> {
  const templates = await prisma.activityTemplate.findMany({
    where: { month },
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });
  if (templates.length === 0) return;
  for (const template of templates) {
    await prisma.activityEntry.upsert({
      where: { groupId_templateId: { groupId, templateId: template.id } },
      update: {},
      create: { groupId, templateId: template.id, month, status: "PLANNED" },
    });
  }
}

/** One month chart for a group, with entries and both e-signatures. */
export async function getMonthChart(groupId: string, month: ActivityMonth): Promise<MonthChart> {
  if (!isChartMonth(month)) {
    throw new AppError("INVALID_INPUT", "Unknown activity month");
  }
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { guide: { select: { name: true } } },
  });
  if (!group) throw new AppError("GROUP_NOT_FOUND", "Group not found");

  await ensureMonthEntries(groupId, month);

  const entries = await prisma.activityEntry.findMany({
    where: { groupId, month },
    include: {
      template: { select: { sortOrder: true, text: true } },
      studentConfirmedBy: { select: { name: true } },
      guideVerifiedBy: { select: { name: true } },
    },
    orderBy: { template: { sortOrder: "asc" } },
  });

  return {
    group: {
      id: group.id,
      groupNo: group.groupNo ?? null,
      status: group.status,
      guideId: group.guideId ?? null,
    },
    guideName: group.guide?.name ?? null,
    month,
    entries: entries.map((entry) => ({
      id: entry.id,
      sortOrder: entry.template.sortOrder,
      text: entry.template.text,
      date: entry.date ?? "",
      status: entry.status,
      statusText: (entry.statusText as "COMPLETE" | "INCOMPLETE" | null) ?? null,
      studentSign: entry.studentConfirmedAt
        ? {
            name: entry.studentConfirmedBy?.name ?? null,
            at: entry.studentConfirmedAt.toISOString(),
          }
        : null,
      guideSign: entry.guideVerifiedAt
        ? {
            name: entry.guideVerifiedBy?.name ?? null,
            at: entry.guideVerifiedAt.toISOString(),
          }
        : null,
    })),
  };
}

/** The single group a student belongs to (charts are kept against it). */
export async function getStudentChartGroupId(userId: string): Promise<string | null> {
  const membership = await prisma.groupMember.findFirst({
    where: { userId },
    select: { groupId: true },
  });
  return membership?.groupId ?? null;
}

/** Assigned groups with their entries, for the guide verification index. */
export async function listGuideChartGroups(guideId: string) {
  return prisma.group.findMany({
    where: { guideId },
    orderBy: { groupNo: "asc" },
    include: { activityEntries: { select: { id: true, month: true, status: true } } },
  });
}

/** Every group with its entries, for the HOD activity index. */
export async function listChartQueue() {
  return prisma.group.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      guide: { select: { name: true } },
      activityEntries: { select: { id: true, month: true, status: true } },
    },
  });
}

async function myStudentGroup(actor: ActivityChartActor) {
  if (actor.role !== "STUDENT") {
    throw new AppError("FORBIDDEN", "Only students of the group can confirm activity entries");
  }
  const membership = await prisma.groupMember.findFirst({
    where: { userId: actor.id },
    include: { group: true },
  });
  if (!membership) throw new AppError("NO_GROUP", "You are not in a group yet");
  return membership.group;
}

async function assertChartOpen(group: { status: string }) {
  if (group.status === "PDF_GENERATED") {
    throw new AppError("LOCKED", "The log book is locked after the final PDF is generated");
  }
  if (!chartsOpen(group.status)) {
    throw new AppError(
      "NOT_ACTIVE",
      "Activity charts unlock once the HOD approves the group and assigns a guide",
    );
  }
}

export type ConfirmResult = {
  status: string;
  studentName: string | null;
  studentConfirmedAt: string;
};

export async function confirmEntry(actor: ActivityChartActor, input: unknown): Promise<ConfirmResult> {
  const group = await myStudentGroup(actor);
  await assertChartOpen(group);

  const parsed = confirmEntrySchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { entryId, date, statusText } = parsed.data;

  const entry = await prisma.activityEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.groupId !== group.id) {
    throw new AppError("NOT_FOUND", "That activity row does not belong to your group");
  }

  const wasVerified = entry.status === "GUIDE_VERIFIED";
  const needsHistory = entry.status !== "PLANNED";
  const snapshot = needsHistory
    ? {
        date: entry.date,
        status: entry.status,
        statusText: entry.statusText,
        studentConfirmedAt: entry.studentConfirmedAt?.toISOString() ?? null,
        studentConfirmedById: entry.studentConfirmedById,
        guideVerifiedAt: entry.guideVerifiedAt?.toISOString() ?? null,
        guideVerifiedById: entry.guideVerifiedById,
        version: entry.version,
      }
    : null;

  const data = {
    date: date || null,
    statusText,
    status: "STUDENT_CONFIRMED",
    studentConfirmedAt: new Date(),
    studentConfirmedById: actor.id,
    // Editing a guide-verified row resets it and requires a fresh countersign.
    guideVerifiedAt: null,
    guideVerifiedById: null,
    version: { increment: 1 },
  };

  const confirmer = await prisma.user.findUnique({
    where: { id: actor.id },
    select: { name: true },
  });

  const result = await prisma.$transaction(async (tx) => {
    if (snapshot) {
      await tx.activityEntryHistory.create({
        data: { entryId: entry.id, snapshot: toJson(snapshot), changedById: actor.id },
      });
    }
    const updated = await tx.activityEntry.update({ where: { id: entry.id }, data });
    await logAction(
      {
        userId: actor.id,
        action: "ENTRY_CONFIRM",
        entity: "ActivityEntry",
        entityId: entry.id,
        before: {
          date: entry.date,
          status: entry.status,
          statusText: entry.statusText,
          wasVerified,
        },
        after: { date: data.date, status: data.status, statusText },
      },
      tx,
    );
    return {
      status: updated.status,
      studentName: confirmer?.name ?? null,
      studentConfirmedAt: updated.studentConfirmedAt?.toISOString() ?? new Date().toISOString(),
    };
  });

  await onEntryConfirmed(group.id, entry.month);

  return result;
}

export type VerifyResult = {
  status: string;
  guideName: string | null;
  guideVerifiedAt: string;
};

export async function verifyEntry(actor: ActivityChartActor, input: unknown): Promise<VerifyResult> {
  const parsed = verifyEntrySchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }

  if (actor.role !== "GUIDE") {
    throw new AppError("FORBIDDEN", "Only the project guide can verify an activity entry");
  }
  const entry = await prisma.activityEntry.findUnique({
    where: { id: parsed.data.entryId },
    include: { group: { select: { id: true, status: true, guideId: true } } },
  });
  if (!entry) throw new AppError("NOT_FOUND", "That activity row does not exist");
  if (entry.group.guideId !== actor.id) {
    throw new AppError("FORBIDDEN", "Only the guide assigned to this group can verify its entries");
  }
  await assertChartOpen(entry.group);
  if (entry.status === "PLANNED") {
    throw new AppError("INVALID_STATE", "The student must confirm the entry before verification");
  }
  if (entry.status === "GUIDE_VERIFIED") {
    throw new AppError("INVALID_STATE", "This entry is already verified");
  }

  const verifier = await prisma.user.findUnique({
    where: { id: actor.id },
    select: { name: true },
  });

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.activityEntry.update({
      where: { id: entry.id },
      data: {
        status: "GUIDE_VERIFIED",
        guideVerifiedAt: new Date(),
        guideVerifiedById: actor.id,
        version: { increment: 1 },
      },
    });
    await logAction(
      {
        userId: actor.id,
        action: "ENTRY_VERIFY",
        entity: "ActivityEntry",
        entityId: entry.id,
        before: { status: entry.status },
        after: { status: updated.status },
      },
      tx,
    );
    return {
      status: updated.status,
      guideName: verifier?.name ?? null,
      guideVerifiedAt: updated.guideVerifiedAt?.toISOString() ?? new Date().toISOString(),
    };
  });

  await onEntryVerified(entry.group.id, entry.month);
  await notifyIfReadyForPdf(entry.group.id);

  return result;
}
