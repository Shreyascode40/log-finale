import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { hashPassword } from "@/lib/password";
import { AppError } from "@/lib/errors";
import {
  approveGroupSchema,
  assignGuideSchema,
  createGuideSchema,
  rejectGroupSchema,
  setUserActiveSchema,
  updateGuideSchema,
} from "@/lib/validation/admin";
import type { CurrentUser } from "@/lib/permissions";

/**
 * HOD administration service (F3). Every function re-checks the actor role on
 * the server: the HOD-only UI is never the enforcement point.
 *
 * Functions take a plain actor so they can be unit-tested directly.
 */

type Actor = Pick<CurrentUser, "id" | "role">;

function assertHod(actor: Actor): void {
  if (actor.role !== "HOD") {
    throw new AppError("FORBIDDEN", "Only the Head of Department can do this");
  }
}

/** Creates a GUIDE account. Guides are never self-registered (rule 11). */
export async function createGuide(actor: Actor, input: unknown): Promise<{ userId: string }> {
  assertHod(actor);

  const parsed = createGuideSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { name, email, mobile, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) throw new AppError("EMAIL_TAKEN", "An account with this email already exists");

  const passwordHash = await hashPassword(password);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name,
        email,
        mobile: mobile || null,
        role: "GUIDE",
        passwordHash,
        // HOD-created staff accounts are usable immediately
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

export async function updateGuide(actor: Actor, input: unknown): Promise<void> {
  assertHod(actor);

  const parsed = updateGuideSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { userId, name, email, mobile } = parsed.data;

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.role !== "GUIDE") throw new AppError("USER_NOT_FOUND", "Guide not found");

  if (email !== target.email) {
    const clash = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (clash) throw new AppError("EMAIL_TAKEN", "An account with this email already exists");
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { name, email, mobile: mobile || null } });
    await logAction(
      {
        userId: actor.id,
        action: "GUIDE_UPDATE",
        entity: "User",
        entityId: userId,
        before: { name: target.name, email: target.email, mobile: target.mobile },
        after: { name, email, mobile: mobile || null },
      },
      tx,
    );
  });
}

/** Activates or deactivates a guide. A deactivated guide cannot sign in. */
export async function setUserActive(actor: Actor, input: unknown): Promise<void> {
  assertHod(actor);

  const parsed = setUserActiveSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { userId, active } = parsed.data;

  if (userId === actor.id) {
    throw new AppError("FORBIDDEN", "You cannot deactivate your own account");
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) throw new AppError("USER_NOT_FOUND", "User not found");

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
export async function approveGroup(actor: Actor, input: unknown): Promise<{ groupId: string }> {
  assertHod(actor);

  const parsed = approveGroupSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { groupId, guideId } = parsed.data;

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw new AppError("GROUP_NOT_FOUND", "Group not found");
  if (group.status !== "SUBMITTED") {
    throw new AppError("INVALID_STATE", "Only a group submitted by the students can be approved");
  }

  const guide = await prisma.user.findFirst({
    where: { id: guideId, role: "GUIDE", active: true },
    select: { id: true, name: true },
  });
  if (!guide) throw new AppError("GUIDE_NOT_FOUND", "Select an active guide account");

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
export async function rejectGroup(actor: Actor, input: unknown): Promise<void> {
  assertHod(actor);

  const parsed = rejectGroupSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { groupId, reason } = parsed.data;

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw new AppError("GROUP_NOT_FOUND", "Group not found");
  if (group.status !== "SUBMITTED") {
    throw new AppError("INVALID_STATE", "Only a submitted group can be rejected");
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

/**
 * Assigns or reassigns the single guide for a group. A guide may be pre-assigned
 * while the group is SUBMITTED, and reassigned while it is ACTIVE.
 */
export async function assignGuide(actor: Actor, input: unknown): Promise<void> {
  assertHod(actor);

  const parsed = assignGuideSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { groupId, guideId } = parsed.data;

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw new AppError("GROUP_NOT_FOUND", "Group not found");
  if (!["SUBMITTED", "ACTIVE"].includes(group.status)) {
    throw new AppError(
      "INVALID_STATE",
      "A guide can be assigned while the group is submitted or active",
    );
  }

  const guide = await prisma.user.findFirst({
    where: { id: guideId, role: "GUIDE", active: true },
    select: { id: true, name: true },
  });
  if (!guide) throw new AppError("GUIDE_NOT_FOUND", "Select an active guide account");

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
}
