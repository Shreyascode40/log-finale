import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { ALLOWED_PHOTO_TYPES, MAX_PHOTO_BYTES, saveUpload } from "@/lib/upload";
import { coverSchema, memberSchema } from "@/lib/validation/group-info";
import type { Role } from "@/lib/roles";

/**
 * Cover sheet and Project Group Information sheets (F5).
 *
 * Only students who belong to the group may edit them; the guide and HOD see
 * the printed values. Every save writes an AuditLog row (master prompt rule 10).
 */

export type GroupInfoActor = { id: string; role: Role };

/** The final PDF freezes the log book; nothing may change afterwards. */
function isLocked(status: string): boolean {
  return status === "PDF_GENERATED";
}

async function myMembership(actor: GroupInfoActor) {
  if (actor.role !== "STUDENT") {
    throw new AppError("FORBIDDEN", "Only students of the group can edit the log book");
  }
  const membership = await prisma.groupMember.findFirst({
    where: { userId: actor.id },
    include: { group: true },
  });
  if (!membership) {
    throw new AppError("NO_GROUP", "You are not in a group yet");
  }
  return membership;
}

/** Read helper for the pages: the student's single group with members + guide. */
export async function getStudentGroupInfo(userId: string) {
  return prisma.groupMember.findFirst({
    where: { userId },
    include: {
      group: {
        include: {
          guide: { select: { name: true } },
          members: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });
}

export async function updateCover(actor: GroupInfoActor, input: unknown): Promise<void> {
  const membership = await myMembership(actor);
  if (isLocked(membership.group.status)) {
    throw new AppError("LOCKED", "The log book is locked after the final PDF is generated");
  }

  const parsed = coverSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const data = {
    department: parsed.data.department || null,
    academicYear: parsed.data.academicYear || null,
    projectTitle: parsed.data.projectTitle || null,
    area: parsed.data.area || null,
    groupNo: parsed.data.groupNo || null,
  };

  const before = {
    department: membership.group.department,
    academicYear: membership.group.academicYear,
    projectTitle: membership.group.projectTitle,
    area: membership.group.area,
    groupNo: membership.group.groupNo,
  };

  await prisma.$transaction(async (tx) => {
    await tx.group.update({ where: { id: membership.groupId }, data });
    await logAction(
      {
        userId: actor.id,
        action: "COVER_UPDATE",
        entity: "Group",
        entityId: membership.groupId,
        before,
        after: data,
      },
      tx,
    );
  });
}

export async function updateMember(actor: GroupInfoActor, input: unknown): Promise<void> {
  const membership = await myMembership(actor);
  if (isLocked(membership.group.status)) {
    throw new AppError("LOCKED", "The log book is locked after the final PDF is generated");
  }

  const parsed = memberSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { memberId, name, teResult, rollNo, examSeatNo, mobile, email, contribution } = parsed.data;

  const target = await prisma.groupMember.findUnique({ where: { id: memberId } });
  if (!target || target.groupId !== membership.groupId) {
    throw new AppError("MEMBER_NOT_FOUND", "That member is not part of your group");
  }

  // Roll number and exam seat number must be unique within the group (B3).
  if (rollNo) {
    const clash = await prisma.groupMember.findFirst({
      where: { groupId: membership.groupId, rollNo, NOT: { id: memberId } },
      select: { name: true },
    });
    if (clash) {
      throw new AppError("DUPLICATE_ROLL", `Roll number ${rollNo} is already used by ${clash.name}`);
    }
  }
  if (examSeatNo) {
    const clash = await prisma.groupMember.findFirst({
      where: { groupId: membership.groupId, examSeatNo, NOT: { id: memberId } },
      select: { name: true },
    });
    if (clash) {
      throw new AppError(
        "DUPLICATE_SEAT",
        `Exam seat number ${examSeatNo} is already used by ${clash.name}`,
      );
    }
  }

  const data = {
    name,
    teResult: teResult || null,
    rollNo: rollNo || null,
    examSeatNo: examSeatNo || null,
    mobile: mobile || null,
    email: email || null,
    contribution: contribution || null,
  };

  const before = {
    name: target.name,
    teResult: target.teResult,
    rollNo: target.rollNo,
    examSeatNo: target.examSeatNo,
    mobile: target.mobile,
    email: target.email,
    contribution: target.contribution,
  };

  await prisma.$transaction(async (tx) => {
    await tx.groupMember.update({ where: { id: memberId }, data });
    await logAction(
      {
        userId: actor.id,
        action: "MEMBER_UPDATE",
        entity: "GroupMember",
        entityId: memberId,
        before,
        after: data,
      },
      tx,
    );
  });
}

export async function updateMemberPhoto(
  actor: GroupInfoActor,
  memberId: string,
  file: File,
): Promise<{ url: string }> {
  const membership = await myMembership(actor);
  if (isLocked(membership.group.status)) {
    throw new AppError("LOCKED", "The log book is locked after the final PDF is generated");
  }

  const target = await prisma.groupMember.findUnique({ where: { id: memberId } });
  if (!target || target.groupId !== membership.groupId) {
    throw new AppError("MEMBER_NOT_FOUND", "That member is not part of your group");
  }

  if (!ALLOWED_PHOTO_TYPES.includes(file.type as (typeof ALLOWED_PHOTO_TYPES)[number])) {
    throw new AppError("INVALID_FILE", "Photo must be a JPG or PNG image");
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new AppError("FILE_TOO_LARGE", "Photo must be 2 MB or smaller");
  }

  const stored = await saveUpload(file, "group-members", target.id);

  await prisma.$transaction(async (tx) => {
    await tx.groupMember.update({ where: { id: memberId }, data: { photoUrl: stored.url } });
    await logAction(
      {
        userId: actor.id,
        action: "MEMBER_PHOTO_UPDATE",
        entity: "GroupMember",
        entityId: memberId,
        before: { photoUrl: target.photoUrl },
        after: { photoUrl: stored.url },
      },
      tx,
    );
  });

  return { url: stored.url };
}
