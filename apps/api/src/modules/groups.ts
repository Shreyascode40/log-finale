import type { Prisma } from "@prisma/client";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { toJson } from "../json.js";
import { prisma } from "../db.js";
import { ApiDomainError } from "../errors.js";

export type GroupActor = {
  id: string;
  role: string;
  email: string;
  rollNo: string | null;
};

const MAX_GROUP_MEMBERS = 4;
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const optionalText = (max: number, label: string) => z.string().trim().max(max, `${label} is too long`).optional().or(z.literal(""));
const createGroupSchema = z.object({
  groupNo: optionalText(20, "Group number"),
  academicYear: optionalText(20, "Academic year"),
  department: optionalText(80, "Department"),
  projectTitle: optionalText(200, "Project title"),
  area: optionalText(120, "Area of project"),
});
const inviteSchema = z.object({ identifier: z.string().trim().min(3, "Enter an email address or roll number").max(120) });
const joinByCodeSchema = z.object({ code: z.string().trim().min(3, "Enter the group code").max(40) });
const inviteResponseSchema = z.object({ inviteId: z.string().min(1) });
const submitGroupSchema = z.object({ groupId: z.string().min(1) });
const removeMemberSchema = z.object({ memberId: z.string().min(1) });

function assertStudent(actor: GroupActor): void {
  if (actor.role !== "STUDENT") {
    throw new ApiDomainError("FORBIDDEN", "Only students can create and join groups", 403);
  }
}

async function uniqueGroupCode(): Promise<string> {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 10; attempt += 1) {
    let code = "";
    for (let i = 0; i < 6; i += 1) code += alphabet[randomInt(alphabet.length)];
    if (!(await prisma.group.findUnique({ where: { code }, select: { id: true } }))) return code;
  }
  throw new ApiDomainError("CODE_FAILED", "Could not allocate a group code, please try again", 503);
}

async function membershipOf(userId: string) {
  return prisma.groupMember.findFirst({ where: { userId }, select: { id: true, groupId: true } });
}

async function assertCanJoin(actor: GroupActor, groupId: string) {
  if (await membershipOf(actor.id)) {
    throw new ApiDomainError("ALREADY_IN_GROUP", "You already belong to a group", 409);
  }
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { _count: { select: { members: true } } },
  });
  if (!group) throw new ApiDomainError("GROUP_NOT_FOUND", "Group not found", 404);
  if (group._count.members >= MAX_GROUP_MEMBERS) {
    throw new ApiDomainError("GROUP_FULL", `A group can have at most ${MAX_GROUP_MEMBERS} members`, 409);
  }
  return group;
}

async function addMember(tx: Prisma.TransactionClient, groupId: string, actorId: string, action: string) {
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
  await tx.auditLog.create({
    data: {
      userId: actorId,
      action,
      entity: "GroupMember",
      entityId: member.id,
      after: toJson({ groupId, userId: actorId }),
    },
  });
}

export async function createGroup(actor: GroupActor, input: unknown) {
  assertStudent(actor);
  const parsed = createGroupSchema.safeParse(input);
  if (!parsed.success) throw new ApiDomainError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  if (await membershipOf(actor.id)) throw new ApiDomainError("ALREADY_IN_GROUP", "You already belong to a group", 409);

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
    await tx.auditLog.create({
      data: {
        userId: actor.id,
        action: "GROUP_CREATE",
        entity: "Group",
        entityId: created.id,
        after: toJson({ groupNo: created.groupNo, code, status: "DRAFT" }),
      },
    });
    return created;
  });
  return { groupId: group.id, code: group.code };
}

export async function inviteMember(actor: GroupActor, input: unknown) {
  assertStudent(actor);
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) throw new ApiDomainError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  const identifier = parsed.data.identifier;
  const isEmail = identifier.includes("@");
  if (isEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(identifier)) {
    throw new ApiDomainError("INVALID_INPUT", "Enter a valid email address");
  }
  const email = isEmail ? identifier.toLowerCase() : null;
  const rollNo = isEmail ? null : identifier;
  const group = await prisma.group.findFirst({ where: { creatorId: actor.id }, include: { members: true } });
  if (!group) throw new ApiDomainError("NO_GROUP", "Create a group before inviting members", 404);
  if (group.status !== "DRAFT") throw new ApiDomainError("INVALID_STATE", "Members can only be invited while the group is a draft", 409);
  if (group.members.length >= MAX_GROUP_MEMBERS) {
    throw new ApiDomainError("GROUP_FULL", `A group can have at most ${MAX_GROUP_MEMBERS} members`, 409);
  }
  if (group.members.some((member) =>
    (email && member.email?.toLowerCase() === email) || (rollNo && member.rollNo === rollNo))) {
    throw new ApiDomainError("ALREADY_MEMBER", "That classmate is already in the group", 409);
  }
  const target = await prisma.user.findFirst({ where: email ? { email } : { rollNo: rollNo! } });
  if (target && await membershipOf(target.id)) {
    throw new ApiDomainError("TARGET_IN_GROUP", "That classmate already belongs to a group", 409);
  }
  const duplicate = await prisma.groupInvite.findFirst({
    where: { groupId: group.id, status: "PENDING", ...(email ? { invitedEmail: email } : { invitedRollNo: rollNo }) },
  });
  if (duplicate) throw new ApiDomainError("INVITE_EXISTS", "An invitation to that classmate is already pending", 409);
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
    await tx.auditLog.create({
      data: {
        userId: actor.id,
        action: "GROUP_INVITE",
        entity: "GroupInvite",
        entityId: created.id,
        after: toJson({ groupId: group.id, invitedEmail: email, invitedRollNo: rollNo }),
      },
    });
    return created;
  });
  return { inviteId: invite.id, code: group.code };
}

function inviteMatches(actor: GroupActor, invite: { invitedEmail: string | null; invitedRollNo: string | null }) {
  return Boolean(
    (invite.invitedEmail && invite.invitedEmail.toLowerCase() === actor.email.toLowerCase()) ||
      (invite.invitedRollNo && actor.rollNo && invite.invitedRollNo === actor.rollNo),
  );
}

export async function acceptInvite(actor: GroupActor, input: unknown) {
  assertStudent(actor);
  const parsed = inviteResponseSchema.safeParse(input);
  if (!parsed.success) throw new ApiDomainError("INVALID_INPUT", "Invalid invitation");
  const invite = await prisma.groupInvite.findUnique({ where: { id: parsed.data.inviteId } });
  if (!invite || invite.status !== "PENDING" || invite.expiresAt.getTime() < Date.now()) {
    throw new ApiDomainError("INVALID_INVITE", "This invitation is no longer valid", 404);
  }
  if (!inviteMatches(actor, invite)) throw new ApiDomainError("FORBIDDEN", "This invitation is not for you", 403);
  await assertCanJoin(actor, invite.groupId);
  await prisma.$transaction(async (tx) => {
    await tx.groupInvite.update({ where: { id: invite.id }, data: { status: "ACCEPTED" } });
    await addMember(tx, invite.groupId, actor.id, "GROUP_INVITE_ACCEPT");
  });
  return { groupId: invite.groupId };
}

export async function declineInvite(actor: GroupActor, input: unknown) {
  assertStudent(actor);
  const parsed = inviteResponseSchema.safeParse(input);
  if (!parsed.success) throw new ApiDomainError("INVALID_INPUT", "Invalid invitation");
  const invite = await prisma.groupInvite.findUnique({ where: { id: parsed.data.inviteId } });
  if (!invite || invite.status !== "PENDING") throw new ApiDomainError("INVALID_INVITE", "This invitation is no longer valid", 404);
  if (!inviteMatches(actor, invite)) throw new ApiDomainError("FORBIDDEN", "This invitation is not for you", 403);
  await prisma.$transaction(async (tx) => {
    await tx.groupInvite.update({ where: { id: invite.id }, data: { status: "DECLINED" } });
    await tx.auditLog.create({
      data: {
        userId: actor.id,
        action: "GROUP_INVITE_DECLINE",
        entity: "GroupInvite",
        entityId: invite.id,
        after: toJson({ status: "DECLINED" }),
      },
    });
  });
}

export async function joinByCode(actor: GroupActor, input: unknown) {
  assertStudent(actor);
  const parsed = joinByCodeSchema.safeParse(input);
  if (!parsed.success) throw new ApiDomainError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  const group = await prisma.group.findUnique({ where: { code: parsed.data.code.toUpperCase() } });
  if (!group) throw new ApiDomainError("GROUP_NOT_FOUND", "No group matches that code", 404);
  if (group.status !== "DRAFT") throw new ApiDomainError("INVALID_STATE", "This group is no longer open to new members", 409);
  await assertCanJoin(actor, group.id);
  await prisma.$transaction((tx) => addMember(tx, group.id, actor.id, "GROUP_JOIN_CODE"));
  return { groupId: group.id };
}

export async function removeMember(actor: GroupActor, input: unknown) {
  assertStudent(actor);
  const parsed = removeMemberSchema.safeParse(input);
  if (!parsed.success) throw new ApiDomainError("INVALID_INPUT", "Invalid member");
  const member = await prisma.groupMember.findUnique({ where: { id: parsed.data.memberId }, include: { group: true } });
  if (!member) throw new ApiDomainError("MEMBER_NOT_FOUND", "Member not found", 404);
  if (member.group.creatorId !== actor.id) throw new ApiDomainError("FORBIDDEN", "Only the group creator can remove members", 403);
  if (member.group.status !== "DRAFT") throw new ApiDomainError("INVALID_STATE", "Members can only be removed while the group is a draft", 409);
  if (member.userId === actor.id) throw new ApiDomainError("FORBIDDEN", "The creator cannot be removed from the group", 403);
  await prisma.$transaction(async (tx) => {
    await tx.groupMember.delete({ where: { id: member.id } });
    await tx.auditLog.create({
      data: {
        userId: actor.id,
        action: "GROUP_MEMBER_REMOVE",
        entity: "GroupMember",
        entityId: member.id,
        before: toJson({ groupId: member.groupId, userId: member.userId }),
      },
    });
  });
}

export async function submitGroup(actor: GroupActor, input: unknown) {
  assertStudent(actor);
  const parsed = submitGroupSchema.safeParse(input);
  if (!parsed.success) throw new ApiDomainError("INVALID_INPUT", "Invalid group");
  const group = await prisma.group.findUnique({
    where: { id: parsed.data.groupId },
    include: { _count: { select: { members: true } } },
  });
  if (!group) throw new ApiDomainError("GROUP_NOT_FOUND", "Group not found", 404);
  if (group.creatorId !== actor.id) throw new ApiDomainError("FORBIDDEN", "Only the group creator can submit the group", 403);
  if (group.status !== "DRAFT") throw new ApiDomainError("INVALID_STATE", "This group has already been submitted", 409);
  if (group._count.members < 1) throw new ApiDomainError("INVALID_STATE", "Add at least one member before submitting", 409);
  await prisma.$transaction(async (tx) => {
    await tx.group.update({ where: { id: group.id }, data: { status: "SUBMITTED", rejectReason: null } });
    await tx.auditLog.create({
      data: {
        userId: actor.id,
        action: "GROUP_SUBMIT",
        entity: "Group",
        entityId: group.id,
        before: toJson({ status: "DRAFT" }),
        after: toJson({ status: "SUBMITTED" }),
      },
    });
  });
}
