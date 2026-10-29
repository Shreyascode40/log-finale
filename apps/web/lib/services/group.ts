import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import type { Role } from "@/lib/roles";
import {
  MAX_GROUP_MEMBERS,
  createGroupSchema,
  inviteResponseSchema,
  inviteSchema,
  joinByCodeSchema,
  removeMemberSchema,
  submitGroupSchema,
} from "@/lib/validation/group";

/**
 * Student group onboarding (F4): create a group, invite up to 3 classmates by
 * email or roll number, join by group code, and submit to the HOD.
 *
 * Server-side invariants enforced here (never only in the UI):
 *   - a student belongs to at most one group
 *   - a group has at most 4 members (the 5th is rejected)
 *   - only the creator submits the group
 */

export type GroupActor = {
  id: string;
  role: Role;
  email: string;
  rollNo: string | null;
};

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function assertStudent(actor: GroupActor): void {
  if (actor.role !== "STUDENT") {
    throw new AppError("FORBIDDEN", "Only students can create and join groups");
  }
}

/** Short, human-friendly, unique code students can share. */
async function uniqueGroupCode(): Promise<string> {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1
  for (let attempt = 0; attempt < 10; attempt += 1) {
    let code = "";
    for (let i = 0; i < 6; i += 1) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    const clash = await prisma.group.findUnique({ where: { code }, select: { id: true } });
    if (!clash) return code;
  }
  throw new AppError("CODE_FAILED", "Could not allocate a group code, please try again");
}

async function membershipOf(userId: string) {
  return prisma.groupMember.findFirst({
    where: { userId },
    select: { id: true, groupId: true },
  });
}

/** Rejects joining a second group, a full group, or a non-existent group. */
async function assertCanJoin(actor: GroupActor, groupId: string) {
  const existing = await membershipOf(actor.id);
  if (existing) throw new AppError("ALREADY_IN_GROUP", "You already belong to a group");

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { _count: { select: { members: true } } },
  });
  if (!group) throw new AppError("GROUP_NOT_FOUND", "Group not found");
  if (group._count.members >= MAX_GROUP_MEMBERS) {
    throw new AppError("GROUP_FULL", `A group can have at most ${MAX_GROUP_MEMBERS} members`);
  }
  return group;
}

async function addMember(
  tx: Prisma.TransactionClient,
  groupId: string,
  actorId: string,
  auditAction: string,
): Promise<void> {
  const user = await tx.user.findUniqueOrThrow({ where: { id: actorId } });
  const member = await tx.groupMember.create({
    data: {
      groupId,
      userId: user.id,
      name: user.name,
      email: user.email,
      rollNo: user.rollNo,
      mobile: user.mobile,
      memberType: "member",
    },
  });
  await logAction(
    {
      userId: actorId,
      action: auditAction,
      entity: "GroupMember",
      entityId: member.id,
      after: { groupId, userId: actorId },
    },
    tx,
  );
}

/** Creates a DRAFT group with the caller as creator and first member. */
export async function createGroup(
  actor: GroupActor,
  input: unknown,
): Promise<{ groupId: string; code: string }> {
  assertStudent(actor);

  const parsed = createGroupSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const existing = await membershipOf(actor.id);
  if (existing) throw new AppError("ALREADY_IN_GROUP", "You already belong to a group");

  const code = await uniqueGroupCode();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: actor.id } });

  const group = await prisma.$transaction(async (tx) => {
    const created = await tx.group.create({
      data: {
        code,
        groupNo: parsed.data.groupNo || null,
        academicYear: parsed.data.academicYear || null,
        department: parsed.data.department || "Computer Engineering",
        projectTitle: parsed.data.projectTitle || null,
        area: parsed.data.area || null,
        status: "DRAFT",
        creatorId: actor.id,
        members: {
          create: {
            userId: user.id,
            name: user.name,
            email: user.email,
            rollNo: user.rollNo,
            mobile: user.mobile,
            memberType: "creator",
          },
        },
      },
    });
    await logAction(
      {
        userId: actor.id,
        action: "GROUP_CREATE",
        entity: "Group",
        entityId: created.id,
        after: { groupNo: created.groupNo, code, status: "DRAFT" },
      },
      tx,
    );
    return created;
  });

  return { groupId: group.id, code: group.code };
}

/** Creator invites a classmate by email or roll number. */
export async function inviteMember(
  actor: GroupActor,
  input: unknown,
): Promise<{ inviteId: string; code: string }> {
  assertStudent(actor);

  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const identifier = parsed.data.identifier;
  const isEmail = identifier.includes("@");
  if (isEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(identifier)) {
    throw new AppError("INVALID_INPUT", "Enter a valid email address");
  }
  const email = isEmail ? identifier.toLowerCase() : null;
  const rollNo = isEmail ? null : identifier;

  const group = await prisma.group.findFirst({
    where: { creatorId: actor.id },
    include: { members: true },
  });
  if (!group) throw new AppError("NO_GROUP", "Create a group before inviting members");
  if (group.status !== "DRAFT") {
    throw new AppError("INVALID_STATE", "Members can only be invited while the group is a draft");
  }
  if (group.members.length >= MAX_GROUP_MEMBERS) {
    throw new AppError("GROUP_FULL", `A group can have at most ${MAX_GROUP_MEMBERS} members`);
  }

  const alreadyMember = group.members.some(
    (member) =>
      (email && member.email?.toLowerCase() === email) || (rollNo && member.rollNo === rollNo),
  );
  if (alreadyMember) throw new AppError("ALREADY_MEMBER", "That classmate is already in the group");

  const target = await prisma.user.findFirst({ where: email ? { email } : { rollNo: rollNo! } });
  if (target) {
    const targetMembership = await membershipOf(target.id);
    if (targetMembership) {
      throw new AppError("TARGET_IN_GROUP", "That classmate already belongs to a group");
    }
  }

  const duplicate = await prisma.groupInvite.findFirst({
    where: {
      groupId: group.id,
      status: "PENDING",
      ...(email ? { invitedEmail: email } : { invitedRollNo: rollNo }),
    },
  });
  if (duplicate) {
    throw new AppError("INVITE_EXISTS", "An invitation to that classmate is already pending");
  }

  const invite = await prisma.$transaction(async (tx) => {
    const created = await tx.groupInvite.create({
      data: {
        groupId: group.id,
        invitedEmail: email,
        invitedRollNo: rollNo,
        status: "PENDING",
        createdById: actor.id,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
    });
    await logAction(
      {
        userId: actor.id,
        action: "GROUP_INVITE",
        entity: "GroupInvite",
        entityId: created.id,
        after: { groupId: group.id, invitedEmail: email, invitedRollNo: rollNo },
      },
      tx,
    );
    return created;
  });

  return { inviteId: invite.id, code: group.code };
}

/** The invited student accepts, becoming a member (respecting the cap). */
export async function acceptInvite(actor: GroupActor, input: unknown): Promise<{ groupId: string }> {
  assertStudent(actor);

  const parsed = inviteResponseSchema.safeParse(input);
  if (!parsed.success) throw new AppError("INVALID_INPUT", "Invalid invitation");

  const invite = await prisma.groupInvite.findUnique({ where: { id: parsed.data.inviteId } });
  if (!invite || invite.status !== "PENDING" || invite.expiresAt.getTime() < Date.now()) {
    throw new AppError("INVALID_INVITE", "This invitation is no longer valid");
  }

  const matches =
    (invite.invitedEmail && invite.invitedEmail.toLowerCase() === actor.email.toLowerCase()) ||
    (invite.invitedRollNo && actor.rollNo && invite.invitedRollNo === actor.rollNo);
  if (!matches) throw new AppError("FORBIDDEN", "This invitation is not for you");

  await assertCanJoin(actor, invite.groupId);

  await prisma.$transaction(async (tx) => {
    await tx.groupInvite.update({ where: { id: invite.id }, data: { status: "ACCEPTED" } });
    await addMember(tx, invite.groupId, actor.id, "GROUP_INVITE_ACCEPT");
  });

  return { groupId: invite.groupId };
}

export async function declineInvite(actor: GroupActor, input: unknown): Promise<void> {
  assertStudent(actor);

  const parsed = inviteResponseSchema.safeParse(input);
  if (!parsed.success) throw new AppError("INVALID_INPUT", "Invalid invitation");

  const invite = await prisma.groupInvite.findUnique({ where: { id: parsed.data.inviteId } });
  if (!invite || invite.status !== "PENDING") {
    throw new AppError("INVALID_INVITE", "This invitation is no longer valid");
  }

  const matches =
    (invite.invitedEmail && invite.invitedEmail.toLowerCase() === actor.email.toLowerCase()) ||
    (invite.invitedRollNo && actor.rollNo && invite.invitedRollNo === actor.rollNo);
  if (!matches) throw new AppError("FORBIDDEN", "This invitation is not for you");

  await prisma.$transaction(async (tx) => {
    await tx.groupInvite.update({ where: { id: invite.id }, data: { status: "DECLINED" } });
    await logAction(
      {
        userId: actor.id,
        action: "GROUP_INVITE_DECLINE",
        entity: "GroupInvite",
        entityId: invite.id,
        after: { status: "DECLINED" },
      },
      tx,
    );
  });
}

/** Joins a DRAFT group using its shared code. */
export async function joinByCode(actor: GroupActor, input: unknown): Promise<{ groupId: string }> {
  assertStudent(actor);

  const parsed = joinByCodeSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const group = await prisma.group.findUnique({ where: { code: parsed.data.code.toUpperCase() } });
  if (!group) throw new AppError("GROUP_NOT_FOUND", "No group matches that code");
  if (group.status !== "DRAFT") {
    throw new AppError("INVALID_STATE", "This group is no longer open to new members");
  }

  await assertCanJoin(actor, group.id);

  await prisma.$transaction(async (tx) => {
    await addMember(tx, group.id, actor.id, "GROUP_JOIN_CODE");
  });

  return { groupId: group.id };
}

/** The creator removes a member while the group is still a draft. */
export async function removeMember(actor: GroupActor, input: unknown): Promise<void> {
  assertStudent(actor);

  const parsed = removeMemberSchema.safeParse(input);
  if (!parsed.success) throw new AppError("INVALID_INPUT", "Invalid member");

  const member = await prisma.groupMember.findUnique({
    where: { id: parsed.data.memberId },
    include: { group: true },
  });
  if (!member) throw new AppError("MEMBER_NOT_FOUND", "Member not found");
  if (member.group.creatorId !== actor.id) {
    throw new AppError("FORBIDDEN", "Only the group creator can remove members");
  }
  if (member.group.status !== "DRAFT") {
    throw new AppError("INVALID_STATE", "Members can only be removed while the group is a draft");
  }
  if (member.userId === actor.id) {
    throw new AppError("FORBIDDEN", "The creator cannot be removed from the group");
  }

  await prisma.$transaction(async (tx) => {
    await tx.groupMember.delete({ where: { id: member.id } });
    await logAction(
      {
        userId: actor.id,
        action: "GROUP_MEMBER_REMOVE",
        entity: "GroupMember",
        entityId: member.id,
        before: { groupId: member.groupId, userId: member.userId },
      },
      tx,
    );
  });
}

/** Creator submits the group for HOD approval (DRAFT -> SUBMITTED). */
export async function submitGroup(actor: GroupActor, input: unknown): Promise<void> {
  assertStudent(actor);

  const parsed = submitGroupSchema.safeParse(input);
  if (!parsed.success) throw new AppError("INVALID_INPUT", "Invalid group");

  const group = await prisma.group.findUnique({
    where: { id: parsed.data.groupId },
    include: { _count: { select: { members: true } } },
  });
  if (!group) throw new AppError("GROUP_NOT_FOUND", "Group not found");
  if (group.creatorId !== actor.id) {
    throw new AppError("FORBIDDEN", "Only the group creator can submit the group");
  }
  if (group.status !== "DRAFT") {
    throw new AppError("INVALID_STATE", "This group has already been submitted");
  }
  if (group._count.members < 1) {
    throw new AppError("INVALID_STATE", "Add at least one member before submitting");
  }

  await prisma.$transaction(async (tx) => {
    await tx.group.update({
      where: { id: group.id },
      data: { status: "SUBMITTED", rejectReason: null },
    });
    await logAction(
      {
        userId: actor.id,
        action: "GROUP_SUBMIT",
        entity: "Group",
        entityId: group.id,
        before: { status: "DRAFT" },
        after: { status: "SUBMITTED" },
      },
      tx,
    );
  });
}
