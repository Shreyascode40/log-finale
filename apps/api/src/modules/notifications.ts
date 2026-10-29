import { prisma } from "../db.js";
import { sendEmail } from "../email.js";
import { getGroupCompletion } from "../completion/index.js";

/**
 * Notifications (F17): in-app rows plus email, per SPEC.md A6. Every helper is
 * best-effort and never throws, so a notification failure can never break the
 * action that triggered it.
 */

export type NotifyMail = { subject: string; text: string };

async function groupMemberIds(groupId: string): Promise<string[]> {
  const members = await prisma.groupMember.findMany({ where: { groupId }, select: { userId: true } });
  return members.map((member) => member.userId);
}

async function hodIds(): Promise<string[]> {
  const hods = await prisma.user.findMany({
    where: { role: "HOD", active: true },
    select: { id: true },
  });
  return hods.map((hod) => hod.id);
}

async function groupGuideId(groupId: string): Promise<string | null> {
  const group = await prisma.group.findUnique({ where: { id: groupId }, select: { guideId: true } });
  return group?.guideId ?? null;
}

async function groupLabel(groupId: string): Promise<string> {
  const group = await prisma.group.findUnique({ where: { id: groupId }, select: { groupNo: true } });
  return group?.groupNo ? `Group ${group.groupNo}` : "Your group";
}

/** In-app rows for these users plus an email each. Never throws. */
export async function notifyUsers(
  userIds: string[],
  type: string,
  message: string,
  mail?: NotifyMail,
): Promise<void> {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return;
  try {
    await prisma.notification.createMany({
      data: ids.map((userId) => ({ userId, type, message })),
    });
  } catch (error) {
    console.error("notifyUsers: inbox write failed", error);
    return;
  }
  if (!mail) return;
  try {
    const users = await prisma.user.findMany({
      where: { id: { in: ids }, active: true },
      select: { email: true },
    });
    for (const user of users) {
      try {
        await sendEmail({ to: user.email, subject: mail.subject, text: mail.text });
      } catch (error) {
        console.error(`notifyUsers: email to ${user.email} failed`, error);
      }
    }
  } catch (error) {
    console.error("notifyUsers: email lookup failed", error);
  }
}

export async function notifyGroupMembers(
  groupId: string,
  type: string,
  message: string,
  mail?: NotifyMail,
): Promise<void> {
  try {
    await notifyUsers(await groupMemberIds(groupId), type, message, mail);
  } catch (error) {
    console.error("notifyGroupMembers failed", error);
  }
}

export async function notifyHods(type: string, message: string, mail?: NotifyMail): Promise<void> {
  try {
    await notifyUsers(await hodIds(), type, message, mail);
  } catch (error) {
    console.error("notifyHods failed", error);
  }
}

export async function notifyGuide(
  groupId: string,
  type: string,
  message: string,
  mail?: NotifyMail,
): Promise<void> {
  try {
    const guideId = await groupGuideId(groupId);
    if (guideId) await notifyUsers([guideId], type, message, mail);
  } catch (error) {
    console.error("notifyGuide failed", error);
  }
}

// ------------------------------------------------------------------- triggers

export async function onGuideAssigned(groupId: string, guideName: string): Promise<void> {
  const label = await groupLabel(groupId);
  await notifyGroupMembers(groupId, "GUIDE_ASSIGNED", `${guideName} is now your project guide (${label}).`, {
    subject: `[Logbook] Guide assigned (${label})`,
    text: `${guideName} has been assigned as the project guide (and reviewer) for ${label}.`,
  });
  const guideId = await groupGuideId(groupId);
  if (guideId) {
    await notifyUsers([guideId], "GUIDE_ASSIGNED", `You were assigned to ${label} as project guide.`, {
      subject: `[Logbook] Assigned to ${label}`,
      text: `You have been assigned as the project guide (and reviewer) for ${label}.`,
    });
  }
}

export async function onEntryConfirmed(groupId: string, month: string): Promise<void> {
  const label = await groupLabel(groupId);
  await notifyGuide(groupId, "ENTRY_CONFIRMED", `A student confirmed an activity row (${label}, ${month}).`, {
    subject: `[Logbook] Activity row confirmed (${label})`,
    text: `A student confirmed an activity row for ${month} in ${label}. It awaits your verification.`,
  });
}

export async function onEntryVerified(groupId: string, month: string): Promise<void> {
  const label = await groupLabel(groupId);
  await notifyGroupMembers(groupId, "ENTRY_VERIFIED", `The guide verified an activity row (${label}, ${month}).`, {
    subject: `[Logbook] Activity row verified (${label})`,
    text: `The guide verified an activity row for ${month} in ${label}.`,
  });
}

export async function onTopicScored(groupId: string, topicNo: number): Promise<void> {
  const label = await groupLabel(groupId);
  await notifyHods("TOPIC_SCORED", `The guide scored Topic ${topicNo} (${label}).`, {
    subject: `[Logbook] Topic ${topicNo} scored (${label})`,
    text: `The guide scored Topic ${topicNo} for ${label}. It awaits an HOD decision.`,
  });
}

export async function onTopicDecided(groupId: string, topicNo: number, approved: boolean): Promise<void> {
  const label = await groupLabel(groupId);
  const verdict = approved ? "approved" : "rejected";
  await notifyGroupMembers(groupId, "TOPIC_DECIDED", `Topic ${topicNo} was ${verdict} (${label}).`, {
    subject: `[Logbook] Topic ${topicNo} ${verdict} (${label})`,
    text: `The HOD ${verdict} Topic ${topicNo} for ${label}.`,
  });
}

export async function onReviewSubmitted(groupId: string, title: string): Promise<void> {
  const label = await groupLabel(groupId);
  await notifyHods("REVIEW_SUBMITTED", `A review was submitted (${title}, ${label}).`, {
    subject: `[Logbook] Review submitted (${label})`,
    text: `The guide submitted "${title}" for ${label}. It awaits approval.`,
  });
}

export async function onMarksApproved(groupId: string, what: string): Promise<void> {
  const label = await groupLabel(groupId);
  const memberIds = await groupMemberIds(groupId);
  const guideId = await groupGuideId(groupId);
  await notifyUsers(
    [...memberIds, ...(guideId ? [guideId] : [])],
    "MARKS_APPROVED",
    `${what} was approved (${label}).`,
    {
      subject: `[Logbook] ${what} approved (${label})`,
      text: `${what} for ${label} has been approved and is now locked.`,
    },
  );
}

export async function onMarksUnlocked(groupId: string, what: string): Promise<void> {
  const label = await groupLabel(groupId);
  const memberIds = await groupMemberIds(groupId);
  const guideId = await groupGuideId(groupId);
  await notifyUsers(
    [...memberIds, ...(guideId ? [guideId] : [])],
    "MARKS_UNLOCKED",
    `${what} was unlocked by the HOD (${label}).`,
    {
      subject: `[Logbook] ${what} unlocked (${label})`,
      text: `The HOD unlocked ${what} for ${label}. It is a draft again.`,
    },
  );
}

export async function onSheetsSubmitted(groupId: string, what: string): Promise<void> {
  const label = await groupLabel(groupId);
  await notifyHods("REVIEW_SUBMITTED", `${what} was submitted (${label}).`, {
    subject: `[Logbook] ${what} submitted (${label})`,
    text: `The guide submitted ${what} for ${label}. It awaits approval.`,
  });
}

export async function onPdfPermission(groupId: string, allowed: boolean): Promise<void> {
  const label = await groupLabel(groupId);
  const verdict = allowed ? "granted" : "revoked";
  await notifyGroupMembers(
    groupId,
    "PDF_PERMISSION",
    `PDF permission was ${verdict} (${label}).`,
    {
      subject: `[Logbook] PDF permission ${verdict} (${label})`,
      text: `The HOD ${verdict} PDF generation permission for ${label}.`,
    },
  );
}

/**
 * Tells every HOD once when a group becomes fully complete (SPEC.md A6:
 * "Group ready for PDF"). Called after writes that can finish the last
 * section; the deterministic message doubles as the dedup key.
 */
export async function notifyIfReadyForPdf(groupId: string): Promise<void> {
  try {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { groupNo: true, status: true },
    });
    if (!group || group.status === "PDF_GENERATED") return;
    const completion = await getGroupCompletion(groupId);
    if (!completion.complete) return;
    const label = group.groupNo ? `Group ${group.groupNo}` : "A group";
    const message = `${label} is ready for PDF generation.`;
    const hods = await hodIds();
    if (hods.length === 0) return;
    const existing = await prisma.notification.findFirst({
      where: { type: "GROUP_READY", message, userId: { in: hods } },
    });
    if (existing) return;
    await notifyUsers(hods, "GROUP_READY", message, {
      subject: `[Logbook] ${label} ready for PDF`,
      text: `${message} Review it and toggle PDF permission.`,
    });
  } catch (error) {
    console.error("notifyIfReadyForPdf failed", error);
  }
}

// ------------------------------------------------------------------- inbox

export type InboxItem = {
  id: string;
  type: string;
  message: string;
  at: string;
  read: boolean;
};

export async function listForUser(
  userId: string,
  limit = 20,
): Promise<{ items: InboxItem[]; unread: number }> {
  const take = Math.min(Math.max(limit, 1), 50);
  const [rows, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take,
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  return {
    items: rows.map((row) => ({
      id: row.id,
      type: row.type,
      message: row.message,
      at: row.createdAt.toISOString(),
      read: row.readAt !== null,
    })),
    unread,
  };
}

export async function markAllRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}
