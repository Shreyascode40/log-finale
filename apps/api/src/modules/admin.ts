import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db.js";
import { fromJson, toJson } from "../json.js";
import { hashPassword } from "../password.js";
import { ApiDomainError } from "../errors.js";
import { getGroupCompletion } from "../completion/index.js";
import { onGuideAssigned, onPdfPermission } from "./notifications.js";

/**
 * HOD Administration Module (F3).
 * Every function re-checks the actor role on the server:
 * the HOD-only UI is never the enforcement point.
 */

export type AdminActor = { id: string; role: string; name?: string };

export type GuideRow = {
  id: string;
  name: string;
  email: string;
  mobile: string | null;
  active: boolean;
  groups: number;
};

export type GuideOption = {
  id: string;
  name: string;
};

export type AssignmentRow = {
  id: string;
  groupNo: string | null;
  projectTitle: string | null;
  status: string;
  guideId: string | null;
  guideName: string | null;
};

export type GroupRow = {
  id: string;
  groupNo: string | null;
  projectTitle: string | null;
  area: string | null;
  status: string;
  rejectReason: string | null;
  isSponsored: boolean;
  guideName: string | null;
  creatorName: string;
  members: { id: string; name: string; rollNo: string | null }[];
};

export type AuditLogRow = {
  id: string;
  timestamp: string;
  action: string;
  entity: string;
  entityId: string | null;
  before: string | null;
  after: string | null;
  user: { name: string; email: string; role: string } | null;
};

export type AuditLogFilterResult = {
  logs: AuditLogRow[];
  entities: { entity: string }[];
  actions: { action: string }[];
};

export type HodDashboardStats = {
  guides: number;
  students: number;
  submitted: number;
  active: number;
  drafts: number;
};

const mobile = z
  .string()
  .trim()
  .regex(/^\d{10}$/, "Mobile must be 10 digits")
  .or(z.literal(""))
  .optional();

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password is too long");

export const createGuideSchema = z.object({
  name: z.string().trim().min(2, "Enter the guide's full name").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  mobile,
  password: passwordSchema,
  department: z.string().trim().max(100).optional(),
});

export const updateGuideSchema = z.object({
  userId: z.string().min(1),
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  mobile,
});

export const setUserActiveSchema = z.object({
  userId: z.string().min(1),
  active: z.boolean(),
});

export const approveGroupSchema = z.object({
  groupId: z.string().min(1),
  guideId: z.string().min(1, "Select the guide (who is also the reviewer)"),
});

export const rejectGroupSchema = z.object({
  groupId: z.string().min(1),
  reason: z.string().trim().min(5, "A rejection reason is required").max(500),
});

export const assignGuideSchema = z.object({
  groupId: z.string().min(1),
  guideId: z.string().min(1, "Select a guide"),
});

export const setGroupSponsoredSchema = z.object({
  groupId: z.string().min(1),
  isSponsored: z.boolean(),
});

export const pdfPermissionSchema = z.object({
  groupId: z.string().min(1),
  allowed: z.boolean(),
});

function assertHod(actor: AdminActor): void {
  if (actor.role !== "HOD") {
    throw new ApiDomainError("FORBIDDEN", "Only the Head of Department can do this", 403);
  }
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

/** Creates a GUIDE account. Guides are never self-registered (rule 11). */
export async function createGuide(actor: AdminActor, input: unknown): Promise<{ userId: string }> {
  assertHod(actor);

  const parsed = createGuideSchema.safeParse(input);
  if (!parsed.success) {
    throw new ApiDomainError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  const { name, email, mobile: guideMobile, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) throw new ApiDomainError("EMAIL_TAKEN", "An account with this email already exists", 400);

  const passwordHash = await hashPassword(password);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name,
        email,
        mobile: guideMobile || null,
        role: "GUIDE",
        passwordHash,
        emailVerifiedAt: new Date(),
        createdVia: "HOD_CREATED",
      },
    });
    await logAction(
      {
        userId: actor.id,
        action: "GUIDE_CREATE",
        entity: "User",
        entityId: created.id,
        after: { name, email, role: "GUIDE" },
      },
      tx,
    );
    return created;
  });

  return { userId: user.id };
}

export async function updateGuide(actor: AdminActor, input: unknown): Promise<void> {
  assertHod(actor);

  const parsed = updateGuideSchema.safeParse(input);
  if (!parsed.success) {
    throw new ApiDomainError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  const { userId, name, email, mobile: guideMobile } = parsed.data;

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.role !== "GUIDE") throw new ApiDomainError("USER_NOT_FOUND", "Guide not found", 404);

  if (email !== target.email) {
    const clash = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (clash) throw new ApiDomainError("EMAIL_TAKEN", "An account with this email already exists", 400);
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { name, email, mobile: guideMobile || null } });
    await logAction(
      {
        userId: actor.id,
        action: "GUIDE_UPDATE",
        entity: "User",
        entityId: userId,
        before: { name: target.name, email: target.email, mobile: target.mobile },
        after: { name, email, mobile: guideMobile || null },
      },
      tx,
    );
  });
}

/** Activates or deactivates a user. */
export async function setUserActive(actor: AdminActor, input: unknown): Promise<void> {
  assertHod(actor);

  const parsed = setUserActiveSchema.safeParse(input);
  if (!parsed.success) {
    throw new ApiDomainError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  const { userId, active } = parsed.data;

  if (userId === actor.id) {
    throw new ApiDomainError("FORBIDDEN", "You cannot deactivate your own account", 403);
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) throw new ApiDomainError("USER_NOT_FOUND", "User not found", 404);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { active } });
    await logAction(
      {
        userId: actor.id,
        action: active ? "USER_ACTIVATE" : "USER_DEACTIVATE",
        entity: "User",
        entityId: userId,
        before: { active: target.active },
        after: { active },
      },
      tx,
    );
  });
}

/**
 * Approves a SUBMITTED group and assigns exactly one guide in the same step,
 * moving the group to ACTIVE (DRAFT -> SUBMITTED -> ACTIVE).
 */
export async function approveGroup(actor: AdminActor, input: unknown): Promise<{ groupId: string }> {
  assertHod(actor);

  const parsed = approveGroupSchema.safeParse(input);
  if (!parsed.success) {
    throw new ApiDomainError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  const { groupId, guideId } = parsed.data;

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw new ApiDomainError("GROUP_NOT_FOUND", "Group not found", 404);
  if (group.status !== "SUBMITTED") {
    throw new ApiDomainError("INVALID_STATE", "Only a group submitted by the students can be approved", 400);
  }

  const guide = await prisma.user.findFirst({
    where: { id: guideId, role: "GUIDE", active: true },
    select: { id: true, name: true },
  });
  if (!guide) throw new ApiDomainError("GUIDE_NOT_FOUND", "Select an active guide account", 404);

  await prisma.$transaction(async (tx) => {
    await tx.group.update({
      where: { id: groupId },
      data: { status: "ACTIVE", guideId: guide.id, rejectReason: null },
    });
    await logAction(
      {
        userId: actor.id,
        action: "GROUP_APPROVE",
        entity: "Group",
        entityId: groupId,
        before: { status: group.status, guideId: group.guideId },
        after: { status: "ACTIVE", guideId: guide.id, guideName: guide.name },
      },
      tx,
    );
  });

  return { groupId };
}

/** Rejects a SUBMITTED group, sending it back to DRAFT with a reason. */
export async function rejectGroup(actor: AdminActor, input: unknown): Promise<void> {
  assertHod(actor);

  const parsed = rejectGroupSchema.safeParse(input);
  if (!parsed.success) {
    throw new ApiDomainError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  const { groupId, reason } = parsed.data;

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw new ApiDomainError("GROUP_NOT_FOUND", "Group not found", 404);
  if (group.status !== "SUBMITTED") {
    throw new ApiDomainError("INVALID_STATE", "Only a submitted group can be rejected", 400);
  }

  await prisma.$transaction(async (tx) => {
    await tx.group.update({ where: { id: groupId }, data: { status: "DRAFT", rejectReason: reason } });
    await logAction(
      {
        userId: actor.id,
        action: "GROUP_REJECT",
        entity: "Group",
        entityId: groupId,
        before: { status: group.status },
        after: { status: "DRAFT", reason },
      },
      tx,
    );
  });
}

/** Assigns or reassigns the single guide for a group. */
export async function assignGuide(actor: AdminActor, input: unknown): Promise<void> {
  assertHod(actor);

  const parsed = assignGuideSchema.safeParse(input);
  if (!parsed.success) {
    throw new ApiDomainError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  const { groupId, guideId } = parsed.data;

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw new ApiDomainError("GROUP_NOT_FOUND", "Group not found", 404);
  if (!["SUBMITTED", "ACTIVE"].includes(group.status)) {
    throw new ApiDomainError(
      "INVALID_STATE",
      "A guide can be assigned while the group is submitted or active",
      400,
    );
  }

  const guide = await prisma.user.findFirst({
    where: { id: guideId, role: "GUIDE", active: true },
    select: { id: true, name: true },
  });
  if (!guide) throw new ApiDomainError("GUIDE_NOT_FOUND", "Select an active guide account", 404);

  const reassigning = Boolean(group.guideId) && group.guideId !== guide.id;

  await prisma.$transaction(async (tx) => {
    await tx.group.update({ where: { id: groupId }, data: { guideId: guide.id } });
    await logAction(
      {
        userId: actor.id,
        action: reassigning ? "GROUP_REASSIGN_GUIDE" : "GROUP_ASSIGN_GUIDE",
        entity: "Group",
        entityId: groupId,
        before: { guideId: group.guideId },
        after: { guideId: guide.id, guideName: guide.name },
      },
      tx,
    );
  });
  await onGuideAssigned(groupId, guide.name);
}

/** Flags or unflags a group as a sponsored project (F14 unlocks its sheets). */
export async function setGroupSponsored(actor: AdminActor, input: unknown): Promise<void> {
  assertHod(actor);

  const parsed = setGroupSponsoredSchema.safeParse(input);
  if (!parsed.success) {
    throw new ApiDomainError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  const { groupId, isSponsored } = parsed.data;

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw new ApiDomainError("GROUP_NOT_FOUND", "Group not found", 404);

  await prisma.$transaction(async (tx) => {
    await tx.group.update({ where: { id: groupId }, data: { isSponsored } });
    await logAction(
      {
        userId: actor.id,
        action: "GROUP_SPONSORED",
        entity: "Group",
        entityId: groupId,
        before: { isSponsored: group.isSponsored },
        after: { isSponsored },
      },
      tx,
    );
  });
}

/** Toggles final-PDF permission for a group (F15). */
export async function setPdfPermission(actor: AdminActor, input: unknown): Promise<void> {
  assertHod(actor);

  const parsed = pdfPermissionSchema.safeParse(input);
  if (!parsed.success) {
    throw new ApiDomainError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  const { groupId, allowed } = parsed.data;

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw new ApiDomainError("GROUP_NOT_FOUND", "Group not found", 404);
  if (group.status === "PDF_GENERATED") {
    throw new ApiDomainError("LOCKED", "The final PDF is already generated for this group", 403);
  }

  const completion = await getGroupCompletion(groupId);
  const now = new Date();

  if (allowed) {
    if (!completion.complete) {
      throw new ApiDomainError(
        "INCOMPLETE",
        `Cannot allow PDF generation: ${completion.missing.join(", ")} still incomplete`,
        400,
      );
    }
    await prisma.$transaction(async (tx) => {
      await tx.group.update({
        where: { id: groupId },
        data: { pdfPermission: true, pdfPermissionBy: actor.id, pdfPermissionAt: now, status: "PDF_ALLOWED" },
      });
      await logAction(
        {
          userId: actor.id,
          action: "GROUP_PDF_ALLOW",
          entity: "Group",
          entityId: groupId,
          before: { pdfPermission: group.pdfPermission, status: group.status },
          after: { pdfPermission: true, status: "PDF_ALLOWED" },
        },
        tx,
      );
    });
    await onPdfPermission(groupId, true);
    return;
  }

  const fallback = completion.complete ? "READY_FOR_PDF" : "ACTIVE";
  const nextStatus = ["PDF_ALLOWED", "READY_FOR_PDF", "ACTIVE"].includes(group.status)
    ? fallback
    : group.status;
  await prisma.$transaction(async (tx) => {
    await tx.group.update({
      where: { id: groupId },
      data: { pdfPermission: false, pdfPermissionBy: null, pdfPermissionAt: null, status: nextStatus },
    });
    await logAction(
      {
        userId: actor.id,
        action: "GROUP_PDF_REVOKE",
        entity: "Group",
        entityId: groupId,
        before: { pdfPermission: group.pdfPermission, status: group.status },
        after: { pdfPermission: false, status: nextStatus },
      },
      tx,
    );
  });
  await onPdfPermission(groupId, false);
}

export async function listGuides(actor: AdminActor): Promise<GuideRow[]> {
  assertHod(actor);
  const guides = await prisma.user.findMany({
    where: { role: "GUIDE" },
    orderBy: { name: "asc" },
    include: { _count: { select: { guidesGroups: true } } },
  });
  return guides.map((guide) => ({
    id: guide.id,
    name: guide.name,
    email: guide.email,
    mobile: guide.mobile,
    active: guide.active,
    groups: guide._count.guidesGroups,
  }));
}

export async function listActiveGuides(actor: AdminActor): Promise<GuideOption[]> {
  assertHod(actor);
  return prisma.user.findMany({
    where: { role: "GUIDE", active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function listAssignments(actor: AdminActor): Promise<{ groups: AssignmentRow[]; guides: GuideOption[] }> {
  assertHod(actor);
  const [groups, guides] = await Promise.all([
    prisma.group.findMany({
      where: { status: { in: ["SUBMITTED", "ACTIVE"] } },
      orderBy: { createdAt: "desc" },
      include: { guide: { select: { id: true, name: true } } },
    }),
    prisma.user.findMany({
      where: { role: "GUIDE", active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const rows: AssignmentRow[] = groups.map((group) => ({
    id: group.id,
    groupNo: group.groupNo,
    projectTitle: group.projectTitle,
    status: group.status,
    guideId: group.guideId,
    guideName: group.guide?.name ?? null,
  }));

  return { groups: rows, guides };
}

export async function listAdminGroups(actor: AdminActor): Promise<{ groups: GroupRow[]; guides: GuideOption[] }> {
  assertHod(actor);
  const [groups, guides] = await Promise.all([
    prisma.group.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        guide: { select: { name: true } },
        creator: { select: { name: true } },
        members: { orderBy: { createdAt: "asc" }, select: { id: true, name: true, rollNo: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: "GUIDE", active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const rows: GroupRow[] = groups.map((group) => ({
    id: group.id,
    groupNo: group.groupNo,
    projectTitle: group.projectTitle,
    area: group.area,
    status: group.status,
    rejectReason: group.rejectReason,
    isSponsored: group.isSponsored,
    guideName: group.guide?.name ?? null,
    creatorName: group.creator.name,
    members: group.members,
  }));

  return { groups: rows, guides };
}

export async function listAuditLogs(
  actor: AdminActor,
  query: { entity?: string; action?: string; user?: string } = {},
): Promise<AuditLogFilterResult> {
  assertHod(actor);

  const entity = query.entity?.trim() || undefined;
  const action = query.action?.trim() || undefined;
  const user = query.user?.trim() || undefined;

  const [rawLogs, rawEntities, rawActions] = await Promise.all([
    prisma.auditLog.findMany({
      where: {
        ...(entity ? { entity } : {}),
        ...(action ? { action: { contains: action } } : {}),
        ...(user ? { user: { email: { contains: user } } } : {}),
      },
      orderBy: { timestamp: "desc" },
      take: 200,
      include: { user: { select: { name: true, email: true, role: true } } },
    }),
    prisma.auditLog.findMany({ distinct: ["entity"], select: { entity: true }, orderBy: { entity: "asc" } }),
    prisma.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
  ]);

  const logs: AuditLogRow[] = rawLogs.map((row) => ({
    id: row.id,
    timestamp: row.timestamp.toISOString(),
    action: row.action,
    entity: row.entity,
    entityId: row.entityId,
    before: row.before ?? null,
    after: row.after ?? null,
    user: row.user,
  }));

  return {
    logs,
    entities: rawEntities,
    actions: rawActions,
  };
}

export async function getHodDashboardStats(actor: AdminActor): Promise<HodDashboardStats> {
  assertHod(actor);
  const [guides, students, submitted, active, drafts] = await Promise.all([
    prisma.user.count({ where: { role: "GUIDE" } }),
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.group.count({ where: { status: "SUBMITTED" } }),
    prisma.group.count({ where: { status: "ACTIVE" } }),
    prisma.group.count({ where: { status: "DRAFT" } }),
  ]);
  return { guides, students, submitted, active, drafts };
}
