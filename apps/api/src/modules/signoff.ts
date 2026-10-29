import { prisma } from "../db.js";
import { toJson } from "../json.js";
import { ApiDomainError } from "../errors.js";

export type SignoffActor = { id: string; role: string };

async function getStudentGroup(actor: SignoffActor) {
  if (actor.role !== "STUDENT") {
    throw new ApiDomainError("FORBIDDEN", "Only students of the group can sign the log book", 403);
  }
  const membership = await prisma.groupMember.findFirst({
    where: { userId: actor.id },
    include: { group: true },
  });
  if (!membership) throw new ApiDomainError("NO_GROUP", "You are not in a group yet", 404);
  if (membership.group.status === "PDF_GENERATED") {
    throw new ApiDomainError("LOCKED", "The log book is locked after the final PDF is generated", 409);
  }
  return membership;
}

async function getTarget(groupId: string, memberId: string) {
  const target = await prisma.groupMember.findUnique({ where: { id: memberId } });
  if (!target || target.groupId !== groupId) {
    throw new ApiDomainError("MEMBER_NOT_FOUND", "That member is not part of your group", 404);
  }
  return target;
}

async function sign(
  actor: SignoffActor,
  memberId: string,
  field: "rulesAckAt" | "undertakingAcceptedAt",
) {
  const membership = await getStudentGroup(actor);
  const target = await getTarget(membership.groupId, memberId);
  const current = target[field];
  const resultKey = field === "rulesAckAt" ? "acknowledgedAt" : "acceptedAt";
  if (current) return { [resultKey]: current.toISOString() };

  const now = new Date();
  const action = field === "rulesAckAt" ? "RULES_ACK" : "UNDERTAKING_ACCEPT";
  await prisma.$transaction(async (tx) => {
    await tx.groupMember.update({ where: { id: target.id }, data: { [field]: now } });
    await tx.auditLog.create({
      data: {
        userId: actor.id,
        action,
        entity: "GroupMember",
        entityId: target.id,
        before: toJson({ [field]: null }),
        after: toJson({ [field]: now }),
      },
    });
  });
  return { [resultKey]: now.toISOString() };
}

export function acknowledgeRules(actor: SignoffActor, memberId: string) {
  return sign(actor, memberId, "rulesAckAt");
}

export function acceptUndertaking(actor: SignoffActor, memberId: string) {
  return sign(actor, memberId, "undertakingAcceptedAt");
}
