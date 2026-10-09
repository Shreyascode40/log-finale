import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import type { Role } from "@/lib/roles";

/**
 * Rules acknowledgement and Undertaking acceptance (F6).
 *
 * A single student handles the whole group: any member of the group may sign any
 * member's row, so the target is a member of the caller's own group. Each row
 * keeps its own timestamp and every signature is audited with the acting user.
 */

export type SignoffActor = { id: string; role: Role };

/** The final PDF freezes the log book; signatures may not change afterwards. */
function isLocked(status: string): boolean {
  return status === "PDF_GENERATED";
}

async function myGroupContext(actor: SignoffActor) {
  if (actor.role !== "STUDENT") {
    throw new AppError("FORBIDDEN", "Only students of the group can sign the log book");
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

/** The target must be a member of the caller's group — never another group. */
async function resolveTarget(groupId: string, memberId: string) {
  const target = await prisma.groupMember.findUnique({ where: { id: memberId } });
  if (!target || target.groupId !== groupId) {
    throw new AppError("MEMBER_NOT_FOUND", "That member is not part of your group");
  }
  return target;
}

/** Records that `memberId` has read and understood the Rules and Regulations. */
export async function acknowledgeRules(
  actor: SignoffActor,
  memberId: string,
): Promise<{ acknowledgedAt: string }> {
  const membership = await myGroupContext(actor);
  if (isLocked(membership.group.status)) {
    throw new AppError("LOCKED", "The log book is locked after the final PDF is generated");
  }
  const target = await resolveTarget(membership.groupId, memberId);

  // Idempotent: a second click keeps the original acknowledgement time.
  if (target.rulesAckAt) {
    return { acknowledgedAt: target.rulesAckAt.toISOString() };
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.groupMember.update({ where: { id: target.id }, data: { rulesAckAt: now } });
    await logAction(
      {
        userId: actor.id,
        action: "RULES_ACK",
        entity: "GroupMember",
        entityId: target.id,
        before: { rulesAckAt: null },
        after: { rulesAckAt: now },
      },
      tx,
    );
  });

  return { acknowledgedAt: now.toISOString() };
}

/** Records that `memberId` has digitally accepted the Undertaking. */
export async function acceptUndertaking(
  actor: SignoffActor,
  memberId: string,
): Promise<{ acceptedAt: string }> {
  const membership = await myGroupContext(actor);
  if (isLocked(membership.group.status)) {
    throw new AppError("LOCKED", "The log book is locked after the final PDF is generated");
  }
  const target = await resolveTarget(membership.groupId, memberId);

  if (target.undertakingAcceptedAt) {
    return { acceptedAt: target.undertakingAcceptedAt.toISOString() };
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.groupMember.update({ where: { id: target.id }, data: { undertakingAcceptedAt: now } });
    await logAction(
      {
        userId: actor.id,
        action: "UNDERTAKING_ACCEPT",
        entity: "GroupMember",
        entityId: target.id,
        before: { undertakingAcceptedAt: null },
        after: { undertakingAcceptedAt: now },
      },
      tx,
    );
  });

  return { acceptedAt: now.toISOString() };
}
