import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db.js";
import { fromJson, toJson } from "../json.js";
import { ApiDomainError } from "../errors.js";
import {
  FINAL_T2_COMPONENTS,
  MOCK_T1_COMPONENTS,
} from "../constants.js";
import {
  notifyIfReadyForPdf,
  onMarksApproved,
  onMarksUnlocked,
  onSheetsSubmitted,
} from "./notifications.js";

export type EvalActor = { id: string; role: string; name?: string };

export type EvalKind = "MOCK_T1" | "FINAL_T2";

export type EvalComponent = { key: string; label: string; max: number };

export type EvalKindConfig = {
  kind: EvalKind;
  components: readonly EvalComponent[];
  auditPrefix: string;
  label: string;
};

export const EVAL_KINDS: Record<EvalKind, EvalKindConfig> = {
  MOCK_T1: {
    kind: "MOCK_T1",
    components: MOCK_T1_COMPONENTS,
    auditPrefix: "MOCK",
    label: "Mock Evaluation table",
  },
  FINAL_T2: {
    kind: "FINAL_T2",
    components: FINAL_T2_COMPONENTS,
    auditPrefix: "FINAL",
    label: "Final Evaluation table",
  },
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
  submittedSign: { name: string | null; at: string | null };
};

export type EvalSaveRows = {
  groupId: string;
  rows: { memberId: string; components: Record<string, number | null | undefined> }[];
};

function componentValidator(max: number) {
  return z
    .number({ invalid_type_error: "Enter a number" })
    .int("Use a whole number")
    .min(0, "Marks cannot be below 0")
    .max(max, `Marks cannot be above ${max}`)
    .nullable()
    .optional();
}

const mockComponentsSchema = z.object(
  Object.fromEntries(
    MOCK_T1_COMPONENTS.map((c) => [c.key, componentValidator(c.max)]),
  ) as Record<string, ReturnType<typeof componentValidator>>,
);

const finalComponentsSchema = z.object(
  Object.fromEntries(
    FINAL_T2_COMPONENTS.map((c) => [c.key, componentValidator(c.max)]),
  ) as Record<string, ReturnType<typeof componentValidator>>,
);

const mockSaveSchema = z.object({
  groupId: z.string().min(1),
  rows: z
    .array(
      z.object({
        memberId: z.string().min(1),
        components: mockComponentsSchema,
      }),
    )
    .min(1)
    .max(4),
});

const finalSaveSchema = z.object({
  groupId: z.string().min(1),
  rows: z
    .array(
      z.object({
        memberId: z.string().min(1),
        components: finalComponentsSchema,
      }),
    )
    .min(1)
    .max(4),
});

const evalSubmitSchema = z.object({
  groupId: z.string().min(1),
});

const evalApproveSchema = z.object({
  groupId: z.string().min(1),
});

const evalUnlockSchema = z
  .object({
    groupId: z.string().min(1),
    reason: z.string().trim().max(300, "Reason is too long").default(""),
  })
  .refine((value) => value.reason.length > 0, {
    message: "A reason is required to unlock approved marks",
    path: ["reason"],
  });

const EVAL_OPEN_STATUSES = ["ACTIVE", "READY_FOR_PDF", "PDF_ALLOWED"];

export function evalOpen(groupStatus: string): boolean {
  return EVAL_OPEN_STATUSES.includes(groupStatus);
}

function assertEvalOpen(group: { status: string }) {
  if (group.status === "PDF_GENERATED") {
    throw new ApiDomainError("LOCKED", "The log book is locked after the final PDF is generated", 409);
  }
  if (!evalOpen(group.status)) {
    throw new ApiDomainError(
      "NOT_ACTIVE",
      "Mark sheets unlock once the HOD approves the group and assigns a guide",
      400,
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

async function assignedGroup(actor: EvalActor, groupId: string) {
  if (actor.role !== "GUIDE") {
    throw new ApiDomainError("FORBIDDEN", "Only the project guide can write marks", 403);
  }
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw new ApiDomainError("GROUP_NOT_FOUND", "Group not found", 404);
  if (group.guideId !== actor.id) {
    throw new ApiDomainError("FORBIDDEN", "Only the guide assigned to this group can write its marks", 403);
  }
  return group;
}

async function kindSheets(groupId: string, kind: EvalKind) {
  await ensureRows(groupId, kind);
  return prisma.marksSheet.findMany({ where: { groupId, kind } });
}

async function logAction(
  input: { userId: string; action: string; entity: string; entityId: string; before?: unknown; after?: unknown },
  tx: Prisma.TransactionClient,
) {
  await tx.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      before: input.before === undefined ? null : toJson(input.before),
      after: input.after === undefined ? null : toJson(input.after),
    },
  });
}

export async function getEvaluationSheet(
  actor: EvalActor,
  groupId: string,
  kind: EvalKind,
): Promise<EvalSheet>;
export async function getEvaluationSheet(
  groupId: string,
  kind: EvalKind,
): Promise<EvalSheet>;
export async function getEvaluationSheet(
  actorOrGroupId: EvalActor | string,
  groupIdOrKind: string | EvalKind,
  maybeKind?: EvalKind,
): Promise<EvalSheet> {
  const actor = typeof actorOrGroupId === "string" ? null : actorOrGroupId;
  const groupId = typeof actorOrGroupId === "string" ? actorOrGroupId : (groupIdOrKind as string);
  const kind = (typeof actorOrGroupId === "string" ? groupIdOrKind : maybeKind!) as EvalKind;

  const config = EVAL_KINDS[kind];
  if (!config) throw new ApiDomainError("NOT_FOUND", "Unknown evaluation kind", 404);

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { guide: { select: { name: true } } },
  });
  if (!group) throw new ApiDomainError("GROUP_NOT_FOUND", "Group not found", 404);

  if (actor) {
    if (actor.role === "STUDENT") {
      const member = await prisma.groupMember.findFirst({
        where: { groupId, userId: actor.id },
        select: { id: true },
      });
      if (!member) throw new ApiDomainError("FORBIDDEN", "You cannot view another group's marks", 403);
    } else if (actor.role === "GUIDE" && group.guideId !== actor.id) {
      throw new ApiDomainError("FORBIDDEN", "Only the assigned guide can view this group's marks", 403);
    } else if (!["STUDENT", "GUIDE", "HOD"].includes(actor.role)) {
      throw new ApiDomainError("FORBIDDEN", "You cannot view mark sheets", 403);
    }
  }

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

export async function getStudentEvalGroupId(actor: EvalActor): Promise<string | null> {
  const membership = await prisma.groupMember.findFirst({
    where: { userId: actor.id },
    select: { groupId: true },
  });
  return membership?.groupId ?? null;
}

export async function listGuideEvalGroups(actor: EvalActor, kind: EvalKind) {
  if (actor.role !== "GUIDE") {
    throw new ApiDomainError("FORBIDDEN", "Only guides can view assigned groups", 403);
  }
  return prisma.group.findMany({
    where: { guideId: actor.id },
    orderBy: { groupNo: "asc" },
    include: {
      markSheets: { where: { kind }, select: { id: true, status: true } },
    },
  });
}

export async function listEvalQueue(actor: EvalActor, kind: EvalKind) {
  if (actor.role !== "HOD") {
    throw new ApiDomainError("FORBIDDEN", "Only the HOD can view the evaluation queue", 403);
  }
  return prisma.group.findMany({
    where: { markSheets: { some: { kind } } },
    orderBy: { updatedAt: "desc" },
    include: {
      guide: { select: { name: true } },
      markSheets: { where: { kind }, select: { id: true, status: true } },
    },
  });
}

export async function saveEvalSheets(
  actor: EvalActor,
  kind: EvalKind,
  input: unknown,
): Promise<void> {
  const config = EVAL_KINDS[kind];
  if (!config) throw new ApiDomainError("NOT_FOUND", "Unknown evaluation kind", 404);

  const schema = kind === "MOCK_T1" ? mockSaveSchema : finalSaveSchema;
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new ApiDomainError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  const { groupId, rows } = parsed.data;

  const group = await assignedGroup(actor, groupId);
  assertEvalOpen(group);

  const members = await prisma.groupMember.findMany({ where: { groupId }, select: { id: true } });
  const memberIds = new Set(members.map((member) => member.id));
  const sheets = await kindSheets(groupId, kind);
  const sheetByMember = new Map(sheets.map((sheet) => [sheet.memberId, sheet]));

  for (const row of rows) {
    if (!memberIds.has(row.memberId)) {
      throw new ApiDomainError("INVALID_INPUT", "That member does not belong to this group", 400);
    }
    const sheet = sheetByMember.get(row.memberId);
    if (!sheet || sheet.status !== "DRAFT") {
      throw new ApiDomainError("INVALID_STATE", "Only draft mark sheets can be edited", 409);
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      const sheet = sheetByMember.get(row.memberId)!;
      const components = emptyComponents(config);
      const rowComponents = row.components as Record<string, number | null | undefined>;
      for (const component of config.components) {
        components[component.key] = rowComponents[component.key] ?? null;
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

export async function submitEvalSheets(
  actor: EvalActor,
  kind: EvalKind,
  inputOrGroupId: unknown,
): Promise<void> {
  const config = EVAL_KINDS[kind];
  if (!config) throw new ApiDomainError("NOT_FOUND", "Unknown evaluation kind", 404);

  const groupId =
    typeof inputOrGroupId === "string"
      ? inputOrGroupId
      : evalSubmitSchema.safeParse(inputOrGroupId).data?.groupId;

  if (!groupId) {
    throw new ApiDomainError("INVALID_INPUT", "Group ID is required", 400);
  }

  const group = await assignedGroup(actor, groupId);
  assertEvalOpen(group);

  const sheets = await kindSheets(groupId, kind);
  const drafts = sheets.filter((sheet) => sheet.status === "DRAFT");
  if (drafts.length === 0) {
    throw new ApiDomainError("INVALID_STATE", "There is no draft mark sheet to submit", 409);
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
  await onSheetsSubmitted(groupId, config.label);
}

export async function approveEvalSheets(
  actor: EvalActor,
  kind: EvalKind,
  inputOrGroupId: unknown,
): Promise<void> {
  const config = EVAL_KINDS[kind];
  if (!config) throw new ApiDomainError("NOT_FOUND", "Unknown evaluation kind", 404);

  const groupId =
    typeof inputOrGroupId === "string"
      ? inputOrGroupId
      : evalApproveSchema.safeParse(inputOrGroupId).data?.groupId;

  if (!groupId) {
    throw new ApiDomainError("INVALID_INPUT", "Group ID is required", 400);
  }

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw new ApiDomainError("GROUP_NOT_FOUND", "Group not found", 404);
  const isAssignedGuide = actor.role === "GUIDE" && group.guideId === actor.id;
  if (!isAssignedGuide && actor.role !== "HOD") {
    throw new ApiDomainError("FORBIDDEN", "Only the assigned guide or the HOD can approve marks", 403);
  }
  assertEvalOpen(group);

  const sheets = await kindSheets(groupId, kind);
  const submitted = sheets.filter((sheet) => sheet.status === "SUBMITTED");
  if (submitted.length === 0) {
    throw new ApiDomainError("INVALID_STATE", "Only submitted mark sheets can be approved", 409);
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
  await onMarksApproved(groupId, config.label);
  await notifyIfReadyForPdf(groupId);
}

export async function unlockEvalSheets(
  actor: EvalActor,
  kind: EvalKind,
  inputOrGroupId: unknown,
  maybeReason?: string,
): Promise<void> {
  const config = EVAL_KINDS[kind];
  if (!config) throw new ApiDomainError("NOT_FOUND", "Unknown evaluation kind", 404);

  if (actor.role !== "HOD") {
    throw new ApiDomainError("FORBIDDEN", "Only the Head of Department can unlock approved marks", 403);
  }

  let groupId: string;
  let reason: string;
  if (typeof inputOrGroupId === "string") {
    groupId = inputOrGroupId;
    reason = maybeReason ?? "";
    if (!reason.trim()) {
      throw new ApiDomainError("INVALID_INPUT", "A reason is required to unlock approved marks", 400);
    }
  } else {
    const parsed = evalUnlockSchema.safeParse(inputOrGroupId);
    if (!parsed.success) {
      throw new ApiDomainError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input", 400);
    }
    groupId = parsed.data.groupId;
    reason = parsed.data.reason;
  }

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw new ApiDomainError("GROUP_NOT_FOUND", "Group not found", 404);
  if (group.status === "PDF_GENERATED") {
    throw new ApiDomainError("LOCKED", "The log book is locked after the final PDF is generated", 409);
  }

  const sheets = await kindSheets(groupId, kind);
  const approved = sheets.filter((sheet) => sheet.status === "APPROVED");
  if (approved.length === 0) {
    throw new ApiDomainError("INVALID_STATE", "Only approved mark sheets can be unlocked", 409);
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
  await onMarksUnlocked(groupId, config.label);
}

// ------------------------------------------------------------- Mock convenience helpers
export function getMockSheet(actor: EvalActor, groupId: string): Promise<EvalSheet>;
export function getMockSheet(groupId: string): Promise<EvalSheet>;
export function getMockSheet(actorOrGroupId: EvalActor | string, maybeGroupId?: string) {
  if (typeof actorOrGroupId === "string") {
    return getEvaluationSheet(actorOrGroupId, "MOCK_T1");
  }
  return getEvaluationSheet(actorOrGroupId, maybeGroupId!, "MOCK_T1");
}
export function saveMockSheets(actor: EvalActor, input: unknown) {
  return saveEvalSheets(actor, "MOCK_T1", input);
}
export function submitMockSheets(actor: EvalActor, input: unknown) {
  return submitEvalSheets(actor, "MOCK_T1", input);
}
export function approveMockSheets(actor: EvalActor, input: unknown) {
  return approveEvalSheets(actor, "MOCK_T1", input);
}
export function unlockMockSheets(actor: EvalActor, input: unknown) {
  return unlockEvalSheets(actor, "MOCK_T1", input);
}

// ------------------------------------------------------------- Final convenience helpers
export function getFinalSheet(actor: EvalActor, groupId: string): Promise<EvalSheet>;
export function getFinalSheet(groupId: string): Promise<EvalSheet>;
export function getFinalSheet(actorOrGroupId: EvalActor | string, maybeGroupId?: string) {
  if (typeof actorOrGroupId === "string") {
    return getEvaluationSheet(actorOrGroupId, "FINAL_T2");
  }
  return getEvaluationSheet(actorOrGroupId, maybeGroupId!, "FINAL_T2");
}
export function saveFinalSheets(actor: EvalActor, input: unknown) {
  return saveEvalSheets(actor, "FINAL_T2", input);
}
export function submitFinalSheets(actor: EvalActor, input: unknown) {
  return submitEvalSheets(actor, "FINAL_T2", input);
}
export function approveFinalSheets(actor: EvalActor, input: unknown) {
  return approveEvalSheets(actor, "FINAL_T2", input);
}
export function unlockFinalSheets(actor: EvalActor, input: unknown) {
  return unlockEvalSheets(actor, "FINAL_T2", input);
}
