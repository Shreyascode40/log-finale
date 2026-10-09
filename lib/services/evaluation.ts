import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { fromJson, toJson } from "@/lib/json";
import { FINAL_T2_COMPONENTS, MOCK_T1_COMPONENTS } from "@/lib/constants";
import type { Role } from "@/lib/roles";

/**
 * Evaluation mark sheets, generic over the two tables (F11 mock, F13 final).
 * One row per group member over the kind's components (total always computed
 * on the server):
 *   DRAFT (assigned guide edits) -> SUBMITTED (guide) -> APPROVED (assigned
 *   guide or HOD, locked). Only the HOD unlocks with a mandatory reason.
 * Submit/approve/unlock act on every eligible row of the group at once; each
 * row keeps its own status and every transition audits per row.
 */

export type EvalActor = { id: string; role: Role };

export type EvalKind = "MOCK_T1" | "FINAL_T2";

export type EvalComponent = { key: string; label: string; max: number };

export type EvalKindConfig = {
  kind: EvalKind;
  components: readonly EvalComponent[];
  /** MOCK | FINAL — prefixes the audit actions. */
  auditPrefix: string;
};

export const EVAL_KINDS: Record<EvalKind, EvalKindConfig> = {
  MOCK_T1: { kind: "MOCK_T1", components: MOCK_T1_COMPONENTS, auditPrefix: "MOCK" },
  FINAL_T2: { kind: "FINAL_T2", components: FINAL_T2_COMPONENTS, auditPrefix: "FINAL" },
};

export type EvalRow = {
  memberId: string;
  memberName: string;
  components: Record<string, number | null>;
  total: number;
  status: string;
  approvedByName: string | null;
  approvedAt: string | null;
  unlockReason: string;
};

export type EvalSheet = {
  group: {
    id: string;
    groupNo: string | null;
    projectTitle: string | null;
    status: string;
    guideId: string | null;
  };
  guideName: string | null;
  rows: EvalRow[];
  /** Committee sign 1: the guide's submission (audit-backed name + time). */
  submittedSign: { name: string | null; at: string | null };
};

export type EvalSaveRows = {
  groupId: string;
  rows: { memberId: string; components: Record<string, number | null | undefined> }[];
};

/** Group statuses in which mark sheets may move (rule 12: ACTIVE). */
const EVAL_OPEN_STATUSES = ["ACTIVE", "READY_FOR_PDF", "PDF_ALLOWED"];

export function evalOpen(groupStatus: string): boolean {
  return EVAL_OPEN_STATUSES.includes(groupStatus);
}

async function assertEvalOpen(group: { status: string }) {
  if (group.status === "PDF_GENERATED") {
    throw new AppError("LOCKED", "The log book is locked after the final PDF is generated");
  }
  if (!evalOpen(group.status)) {
    throw new AppError(
      "NOT_ACTIVE",
      "Mark sheets unlock once the HOD approves the group and assigns a guide",
    );
  }
}

function emptyComponents(config: EvalKindConfig): Record<string, number | null> {
  return Object.fromEntries(config.components.map((c) => [c.key, null]));
}

function parsedComponents(config: EvalKindConfig, raw: string): Record<string, number | null> {
  const parsed = fromJson<Record<string, unknown>>(raw, {});
  const out = emptyComponents(config);
  for (const component of config.components) {
    const value = parsed[component.key];
    out[component.key] = typeof value === "number" && !Number.isNaN(value) ? value : null;
  }
  return out;
}

function totalOf(config: EvalKindConfig, components: Record<string, number | null>): number {
  return config.components.reduce((sum, component) => sum + (components[component.key] ?? 0), 0);
}

/** Materialize one DRAFT row per current member (new members get a row). */
async function ensureRows(groupId: string, kind: EvalKind) {
  const members = await prisma.groupMember.findMany({
    where: { groupId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  for (const member of members) {
    await prisma.marksSheet.upsert({
      where: { groupId_memberId_kind: { groupId, memberId: member.id, kind } },
      update: {},
      create: { groupId, memberId: member.id, kind, components: "{}", status: "DRAFT" },
    });
  }
}

/** The full evaluation table for a group, with totals and signatures. */
export async function getEvaluationSheet(groupId: string, kind: EvalKind): Promise<EvalSheet> {
  const config = EVAL_KINDS[kind];
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { guide: { select: { name: true } } },
  });
  if (!group) throw new AppError("GROUP_NOT_FOUND", "Group not found");

  await ensureRows(groupId, kind);

  const members = await prisma.groupMember.findMany({
    where: { groupId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  const sheets = await prisma.marksSheet.findMany({
    where: { groupId, kind },
    include: { approvedBy: { select: { name: true } } },
  });

  // Committee sign 1: the latest submission of one of this group's rows.
  const groupSubmit =
    sheets.length > 0
      ? await prisma.auditLog.findFirst({
          where: {
            action: `${config.auditPrefix}_SUBMIT`,
            entity: "MarksSheet",
            entityId: { in: sheets.map((sheet) => sheet.id) },
          },
          orderBy: { timestamp: "desc" },
          include: { user: { select: { name: true } } },
        })
      : null;

  const byMember = new Map(sheets.map((sheet) => [sheet.memberId, sheet]));
  return {
    group: {
      id: group.id,
      groupNo: group.groupNo ?? null,
      projectTitle: group.projectTitle ?? null,
      status: group.status,
      guideId: group.guideId ?? null,
    },
    guideName: group.guide?.name ?? null,
    rows: members.map((member) => {
      const sheet = byMember.get(member.id);
      const components = parsedComponents(config, sheet?.components ?? "{}");
      return {
        memberId: member.id,
        memberName: member.name,
        components,
        total: sheet?.total ?? totalOf(config, components),
        status: sheet?.status ?? "DRAFT",
        approvedByName: sheet?.approvedBy?.name ?? null,
        approvedAt: sheet?.approvedAt ? sheet.approvedAt.toISOString() : null,
        unlockReason: sheet?.unlockReason ?? "",
      };
    }),
    submittedSign: {
      name: groupSubmit?.user?.name ?? null,
      at: groupSubmit ? groupSubmit.timestamp.toISOString() : null,
    },
  };
}

/** The single group a student belongs to (mark sheets are read-only for them). */
export async function getStudentEvalGroupId(userId: string): Promise<string | null> {
  const membership = await prisma.groupMember.findFirst({
    where: { userId },
    select: { groupId: true },
  });
  return membership?.groupId ?? null;
}

/** Assigned groups with their rows of this kind, for the guide index. */
export async function listGuideEvalGroups(guideId: string, kind: EvalKind) {
  return prisma.group.findMany({
    where: { guideId },
    orderBy: { groupNo: "asc" },
    include: {
      markSheets: { where: { kind }, select: { id: true, status: true } },
    },
  });
}

/** Every group that has rows of this kind, for the HOD queue. */
export async function listEvalQueue(kind: EvalKind) {
  return prisma.group.findMany({
    where: { markSheets: { some: { kind } } },
    orderBy: { updatedAt: "desc" },
    include: {
      guide: { select: { name: true } },
      markSheets: { where: { kind }, select: { id: true, status: true } },
    },
  });
}

async function assignedGroup(actor: EvalActor, groupId: string) {
  if (actor.role !== "GUIDE") {
    throw new AppError("FORBIDDEN", "Only the project guide can write marks");
  }
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw new AppError("GROUP_NOT_FOUND", "Group not found");
  if (group.guideId !== actor.id) {
    throw new AppError("FORBIDDEN", "Only the guide assigned to this group can write its marks");
  }
  return group;
}

async function kindSheets(groupId: string, kind: EvalKind) {
  await ensureRows(groupId, kind);
  return prisma.marksSheet.findMany({ where: { groupId, kind } });
}

export async function saveEvalSheets(
  actor: EvalActor,
  kind: EvalKind,
  data: EvalSaveRows,
): Promise<void> {
  const config = EVAL_KINDS[kind];
  const { groupId, rows } = data;

  const group = await assignedGroup(actor, groupId);
  await assertEvalOpen(group);

  const members = await prisma.groupMember.findMany({ where: { groupId }, select: { id: true } });
  const memberIds = new Set(members.map((member) => member.id));
  const sheets = await kindSheets(groupId, kind);
  const sheetByMember = new Map(sheets.map((sheet) => [sheet.memberId, sheet]));

  for (const row of rows) {
    if (!memberIds.has(row.memberId)) {
      throw new AppError("INVALID_INPUT", "That member does not belong to this group");
    }
    const sheet = sheetByMember.get(row.memberId);
    if (!sheet || sheet.status !== "DRAFT") {
      throw new AppError("INVALID_STATE", "Only draft mark sheets can be edited");
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      const sheet = sheetByMember.get(row.memberId)!;
      const components = emptyComponents(config);
      for (const component of config.components) {
        components[component.key] = row.components[component.key] ?? null;
      }
      const total = totalOf(config, components);
      await tx.marksSheet.update({
        where: { id: sheet.id },
        data: { components: toJson(components), total, guideId: actor.id },
      });
      await logAction(
        {
          userId: actor.id,
          action: `${config.auditPrefix}_SAVE`,
          entity: "MarksSheet",
          entityId: sheet.id,
          before: { status: sheet.status, total: sheet.total },
          after: { status: "DRAFT", total },
        },
        tx,
      );
    }
  });
}

export async function submitEvalSheets(actor: EvalActor, kind: EvalKind, groupId: string): Promise<void> {
  const config = EVAL_KINDS[kind];
  const group = await assignedGroup(actor, groupId);
  await assertEvalOpen(group);

  const sheets = await kindSheets(groupId, kind);
  const drafts = sheets.filter((sheet) => sheet.status === "DRAFT");
  if (drafts.length === 0) {
    throw new AppError("INVALID_STATE", "There is no draft mark sheet to submit");
  }

  await prisma.$transaction(async (tx) => {
    for (const sheet of drafts) {
      await tx.marksSheet.update({
        where: { id: sheet.id },
        data: { status: "SUBMITTED", guideId: actor.id },
      });
      await logAction(
        {
          userId: actor.id,
          action: `${config.auditPrefix}_SUBMIT`,
          entity: "MarksSheet",
          entityId: sheet.id,
          before: { status: "DRAFT" },
          after: { status: "SUBMITTED" },
        },
        tx,
      );
    }
  });
}

export async function approveEvalSheets(actor: EvalActor, kind: EvalKind, groupId: string): Promise<void> {
  const config = EVAL_KINDS[kind];
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw new AppError("GROUP_NOT_FOUND", "Group not found");
  const isAssignedGuide = actor.role === "GUIDE" && group.guideId === actor.id;
  if (!isAssignedGuide && actor.role !== "HOD") {
    throw new AppError("FORBIDDEN", "Only the assigned guide or the HOD can approve marks");
  }
  await assertEvalOpen(group);

  const sheets = await kindSheets(groupId, kind);
  const submitted = sheets.filter((sheet) => sheet.status === "SUBMITTED");
  if (submitted.length === 0) {
    throw new AppError("INVALID_STATE", "Only submitted mark sheets can be approved");
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    for (const sheet of submitted) {
      await tx.marksSheet.update({
        where: { id: sheet.id },
        data: { status: "APPROVED", approvedById: actor.id, approvedAt: now },
      });
      await logAction(
        {
          userId: actor.id,
          action: `${config.auditPrefix}_APPROVE`,
          entity: "MarksSheet",
          entityId: sheet.id,
          before: { status: "SUBMITTED" },
          after: { status: "APPROVED" },
        },
        tx,
      );
    }
  });
}

export async function unlockEvalSheets(
  actor: EvalActor,
  kind: EvalKind,
  groupId: string,
  reason: string,
): Promise<void> {
  const config = EVAL_KINDS[kind];
  if (actor.role !== "HOD") {
    throw new AppError("FORBIDDEN", "Only the Head of Department can unlock approved marks");
  }
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw new AppError("GROUP_NOT_FOUND", "Group not found");
  if (group.status === "PDF_GENERATED") {
    throw new AppError("LOCKED", "The log book is locked after the final PDF is generated");
  }

  const sheets = await kindSheets(groupId, kind);
  const approved = sheets.filter((sheet) => sheet.status === "APPROVED");
  if (approved.length === 0) {
    throw new AppError("INVALID_STATE", "Only approved mark sheets can be unlocked");
  }

  await prisma.$transaction(async (tx) => {
    for (const sheet of approved) {
      await tx.marksSheet.update({
        where: { id: sheet.id },
        data: {
          status: "DRAFT",
          approvedById: null,
          approvedAt: null,
          unlockReason: reason,
        },
      });
      await logAction(
        {
          userId: actor.id,
          action: `${config.auditPrefix}_UNLOCK`,
          entity: "MarksSheet",
          entityId: sheet.id,
          before: { status: "APPROVED" },
          after: { status: "DRAFT", unlockReason: reason },
        },
        tx,
      );
    }
  });
}
