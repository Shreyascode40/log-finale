import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { fromJson, toJson } from "@/lib/json";
import { ALLOWED_PHOTO_TYPES, MAX_PHOTO_BYTES, saveUpload } from "@/lib/upload";
import { SPONSOR_PARAMETERS } from "@/lib/constants";
import {
  meetingIdSchema,
  meetingSchema,
  sponsorFeedbackSchema,
} from "@/lib/validation/sponsored";
import { notifyIfReadyForPdf } from "@/lib/services/notifications";
import type { Role } from "@/lib/roles";

/**
 * Sponsored project sheets (F14, SPEC.md B13). Only groups the HOD flagged
 * with `isSponsored` use them:
 *   - meeting log per semester: students add rows (date + the two summaries),
 *     sign their own row, record the external guide's signature date, and the
 *     assigned guide countersigns;
 *   - sponsor feedback: students rate the 7 parameters High/Medium/Low, name
 *     the company and upload the seal scan (which carries the authority sign).
 *
 * Reads and writes are permission-checked here, never in the UI.
 */

export type SponsoredActor = { id: string; role: Role };

export type MeetingSign = { name: string | null; at: string | null };

export type MeetingRow = {
  id: string;
  sortOrder: number;
  date: string;
  summaryPrev: string;
  summaryNext: string;
  studentSign: MeetingSign | null;
  guideSign: MeetingSign | null;
  externalSignAt: string | null;
};

export type SponsoredSheet = {
  group: {
    id: string;
    groupNo: string | null;
    projectTitle: string | null;
    status: string;
    guideId: string | null;
    isSponsored: boolean;
  };
  guideName: string | null;
  semesters: { semester: "SEMESTER_1" | "SEMESTER_2"; title: string; rows: MeetingRow[] }[];
  feedback: {
    company: string;
    ratings: Record<string, string | null>;
    sealUrl: string | null;
    signedAt: string | null;
  };
};

async function myStudentGroup(actor: SponsoredActor) {
  if (actor.role !== "STUDENT") {
    throw new AppError("FORBIDDEN", "Only students of the group can edit the meeting log");
  }
  const membership = await prisma.groupMember.findFirst({
    where: { userId: actor.id },
    include: { group: true },
  });
  if (!membership) throw new AppError("NO_GROUP", "You are not in a group yet");
  return membership;
}

async function assertSponsored(group: { isSponsored: boolean }) {
  if (!group.isSponsored) {
    throw new AppError("NOT_SPONSORED", "Only sponsored project groups use these sheets");
  }
}

async function assertUnlocked(group: { status: string }) {
  if (group.status === "PDF_GENERATED") {
    throw new AppError("LOCKED", "The log book is locked after the final PDF is generated");
  }
}

/** The full sponsored bundle for a group (empty rows when not sponsored). */
export async function getSponsoredSheet(groupId: string): Promise<SponsoredSheet> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { guide: { select: { name: true } } },
  });
  if (!group) throw new AppError("GROUP_NOT_FOUND", "Group not found");

  const [meetings, feedback] = await Promise.all([
    prisma.sponsoredMeeting.findMany({
      where: { groupId },
      orderBy: [{ semester: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.sponsorFeedback.findUnique({ where: { groupId } }),
  ]);

  const toRow = (meeting: (typeof meetings)[number]): MeetingRow => ({
    id: meeting.id,
    sortOrder: meeting.sortOrder,
    date: meeting.date ?? "",
    summaryPrev: meeting.summaryPrev ?? "",
    summaryNext: meeting.summaryNext ?? "",
    studentSign: meeting.studentSignedAt
      ? { name: null, at: meeting.studentSignedAt.toISOString() }
      : null,
    guideSign: meeting.guideSignedAt
      ? { name: group.guide?.name ?? null, at: meeting.guideSignedAt.toISOString() }
      : null,
    externalSignAt: meeting.externalGuideSignedAt
      ? meeting.externalGuideSignedAt.toISOString()
      : null,
  });

  // The student e-signature resolves through the audit trail (the schema keeps
  // only the timestamp). Filled in below per signed row.
  const signedIds = meetings.filter((m) => m.studentSignedAt).map((m) => m.id);
  const signAudits =
    signedIds.length > 0
      ? await prisma.auditLog.findMany({
          where: { action: "MEETING_SIGN", entity: "SponsoredMeeting", entityId: { in: signedIds } },
          orderBy: { timestamp: "desc" },
          include: { user: { select: { name: true } } },
        })
      : [];
  const signerByEntry = new Map<string, string | null>();
  for (const audit of signAudits) {
    if (audit.entityId && !signerByEntry.has(audit.entityId)) {
      signerByEntry.set(audit.entityId, audit.user?.name ?? null);
    }
  }

  const rows = meetings.map((meeting) => {
    const row = toRow(meeting);
    if (row.studentSign) row.studentSign.name = signerByEntry.get(meeting.id) ?? null;
    return { ...row, semester: meeting.semester };
  });

  const ratings: Record<string, string | null> = {};
  for (const param of SPONSOR_PARAMETERS) ratings[param.key] = null;
  if (feedback) {
    const saved = fromJson<Record<string, unknown>>(feedback.ratings, {});
    for (const param of SPONSOR_PARAMETERS) {
      const value = saved[param.key];
      ratings[param.key] = value === "HIGH" || value === "MEDIUM" || value === "LOW" ? value : null;
    }
  }

  return {
    group: {
      id: group.id,
      groupNo: group.groupNo ?? null,
      projectTitle: group.projectTitle ?? null,
      status: group.status,
      guideId: group.guideId ?? null,
      isSponsored: group.isSponsored,
    },
    guideName: group.guide?.name ?? null,
    semesters: [
      {
        semester: "SEMESTER_1",
        title: "Meeting Log Semester 1",
        rows: rows.filter((row) => row.semester === "SEMESTER_1"),
      },
      {
        semester: "SEMESTER_2",
        title: "Meeting Log Semester 2",
        rows: rows.filter((row) => row.semester === "SEMESTER_2"),
      },
    ],
    feedback: {
      company: feedback?.company ?? "",
      ratings,
      sealUrl: feedback?.sealUrl ?? null,
      signedAt: feedback?.signedAt ? feedback.signedAt.toISOString() : null,
    },
  };
}

/** The single group a student belongs to. */
export async function getStudentSponsoredGroupId(userId: string): Promise<string | null> {
  const membership = await prisma.groupMember.findFirst({
    where: { userId },
    select: { groupId: true },
  });
  return membership?.groupId ?? null;
}

/** Assigned groups, for the guide countersign index. */
export async function listGuideSponsoredGroups(guideId: string) {
  return prisma.group.findMany({
    where: { guideId },
    orderBy: { groupNo: "asc" },
    include: {
      sponsoredMeetings: { select: { id: true, guideSignedAt: true } },
    },
  });
}

/** Every group, for the HOD index (sponsored ones carry the sheets). */
export async function listSponsoredQueue() {
  return prisma.group.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      guide: { select: { name: true } },
      sponsoredMeetings: { select: { id: true } },
    },
  });
}

async function ownedMeeting(actor: SponsoredActor, id: string) {
  const membership = await myStudentGroup(actor);
  const meeting = await prisma.sponsoredMeeting.findUnique({ where: { id } });
  if (!meeting || meeting.groupId !== membership.groupId) {
    throw new AppError("NOT_FOUND", "That meeting row does not belong to your group");
  }
  await assertSponsored(membership.group);
  await assertUnlocked(membership.group);
  return { group: membership.group, meeting, membership };
}

export async function saveMeeting(actor: SponsoredActor, input: unknown) {
  const parsed = meetingSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { id, semester, date, summaryPrev, summaryNext } = parsed.data;
  const data = {
    date: date || null,
    summaryPrev: summaryPrev || null,
    summaryNext: summaryNext || null,
  };

  if (id) {
    const { meeting } = await ownedMeeting(actor, id);
    const updated = await prisma.$transaction(async (tx) => {
      // Editing clears every signature — fresh countersigns are required.
      const saved = await tx.sponsoredMeeting.update({
        where: { id: meeting.id },
        data: { ...data, studentSignedAt: null, guideSignedAt: null, externalGuideSignedAt: null },
      });
      await logAction(
        {
          userId: actor.id,
          action: "MEETING_UPDATE",
          entity: "SponsoredMeeting",
          entityId: saved.id,
          before: { date: meeting.date },
          after: data,
        },
        tx,
      );
      return saved;
    });
    return updated;
  }

  const membership = await myStudentGroup(actor);
  await assertSponsored(membership.group);
  await assertUnlocked(membership.group);
  const maxSort = await prisma.sponsoredMeeting.findFirst({
    where: { groupId: membership.groupId, semester },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const created = await prisma.$transaction(async (tx) => {
    const saved = await tx.sponsoredMeeting.create({
      data: {
        groupId: membership.groupId,
        semester,
        sortOrder: (maxSort?.sortOrder ?? 0) + 1,
        ...data,
      },
    });
    await logAction(
      { userId: actor.id, action: "MEETING_CREATE", entity: "SponsoredMeeting", entityId: saved.id, after: { semester } },
      tx,
    );
    return saved;
  });
  return created;
}

export async function deleteMeeting(actor: SponsoredActor, input: unknown) {
  const parsed = meetingIdSchema.safeParse(input);
  if (!parsed.success) throw new AppError("INVALID_INPUT", "Invalid input");
  const { meeting } = await ownedMeeting(actor, parsed.data.id);
  await prisma.$transaction(async (tx) => {
    await tx.sponsoredMeeting.delete({ where: { id: meeting.id } });
    await logAction(
      { userId: actor.id, action: "MEETING_DELETE", entity: "SponsoredMeeting", entityId: meeting.id, before: { date: meeting.date } },
      tx,
    );
  });
}

export async function signMeetingStudent(actor: SponsoredActor, input: unknown) {
  const parsed = meetingIdSchema.safeParse(input);
  if (!parsed.success) throw new AppError("INVALID_INPUT", "Invalid input");
  const { meeting, membership } = await ownedMeeting(actor, parsed.data.id);

  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    // A second click keeps the original timestamp (as on rules/undertaking).
    const signedAt = meeting.studentSignedAt ?? now;
    if (!meeting.studentSignedAt) {
      await tx.sponsoredMeeting.update({ where: { id: meeting.id }, data: { studentSignedAt: signedAt } });
    }
    await logAction(
      { userId: actor.id, action: "MEETING_SIGN", entity: "SponsoredMeeting", entityId: meeting.id, after: { signedAt: signedAt.toISOString() } },
      tx,
    );
    return signedAt;
  });
  return { name: membership.name, at: result.toISOString() };
}

export async function signMeetingGuide(actor: SponsoredActor, input: unknown) {
  if (actor.role !== "GUIDE") {
    throw new AppError("FORBIDDEN", "Only the project guide can countersign the meeting log");
  }
  const parsed = meetingIdSchema.safeParse(input);
  if (!parsed.success) throw new AppError("INVALID_INPUT", "Invalid input");

  const meeting = await prisma.sponsoredMeeting.findUnique({
    where: { id: parsed.data.id },
    include: { group: { include: { guide: { select: { name: true } } } } },
  });
  if (!meeting) throw new AppError("NOT_FOUND", "That meeting row does not exist");
  if (meeting.group.guideId !== actor.id) {
    throw new AppError("FORBIDDEN", "Only the guide assigned to this group can countersign");
  }
  await assertSponsored(meeting.group);
  await assertUnlocked(meeting.group);
  if (!meeting.studentSignedAt) {
    throw new AppError("INVALID_STATE", "The student must sign the row before the guide countersigns");
  }

  const now = new Date();
  const signedAt = meeting.guideSignedAt ?? now;
  await prisma.$transaction(async (tx) => {
    if (!meeting.guideSignedAt) {
      await tx.sponsoredMeeting.update({ where: { id: meeting.id }, data: { guideSignedAt: signedAt } });
    }
    await logAction(
      { userId: actor.id, action: "MEETING_GUIDE_SIGN", entity: "SponsoredMeeting", entityId: meeting.id, after: { signedAt: signedAt.toISOString() } },
      tx,
    );
  });
  return { name: meeting.group.guide?.name ?? null, at: signedAt.toISOString() };
}

/**
 * Records the external guide's offline signature date. The external guide has
 * no account, so the student who arranged the meeting records the date; the
 * audit log captures who recorded it.
 */
export async function recordExternalSign(actor: SponsoredActor, input: unknown) {
  const parsed = meetingIdSchema.safeParse(input);
  if (!parsed.success) throw new AppError("INVALID_INPUT", "Invalid input");
  const { meeting } = await ownedMeeting(actor, parsed.data.id);

  const now = new Date();
  const signedAt = meeting.externalGuideSignedAt ?? now;
  await prisma.$transaction(async (tx) => {
    if (!meeting.externalGuideSignedAt) {
      await tx.sponsoredMeeting.update({ where: { id: meeting.id }, data: { externalGuideSignedAt: signedAt } });
    }
    await logAction(
      { userId: actor.id, action: "MEETING_EXTERNAL_SIGN", entity: "SponsoredMeeting", entityId: meeting.id, after: { signedAt: signedAt.toISOString() } },
      tx,
    );
  });
  return { at: signedAt.toISOString() };
}

export async function saveSponsorFeedback(actor: SponsoredActor, input: unknown) {
  const parsed = sponsorFeedbackSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const membership = await myStudentGroup(actor);
  await assertSponsored(membership.group);
  await assertUnlocked(membership.group);

  const data = {
    company: parsed.data.company || null,
    ratings: toJson(parsed.data.ratings),
    signedAt: new Date(),
  };
  const existing = await prisma.sponsorFeedback.findUnique({ where: { groupId: membership.groupId } });
  const saved = await prisma.$transaction(async (tx) => {
    const row = existing
      ? await tx.sponsorFeedback.update({ where: { id: existing.id }, data })
      : await tx.sponsorFeedback.create({ data: { groupId: membership.groupId, ...data } });
    await logAction(
      { userId: actor.id, action: "SPONSOR_FEEDBACK_SAVE", entity: "SponsorFeedback", entityId: row.id, after: { company: data.company } },
      tx,
    );
    return row;
  });
  await notifyIfReadyForPdf(membership.groupId);
  return { signedAt: saved.signedAt?.toISOString() ?? null };
}

export async function uploadSeal(actor: SponsoredActor, file: File) {
  const membership = await myStudentGroup(actor);
  await assertSponsored(membership.group);
  await assertUnlocked(membership.group);

  if (!(ALLOWED_PHOTO_TYPES as readonly string[]).includes(file.type)) {
    throw new AppError("INVALID_FILE", "The seal scan must be a JPG or PNG image");
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new AppError("FILE_TOO_BIG", "The seal scan must be at most 2 MB");
  }
  const stored = await saveUpload(file, "seals", `seal-${membership.groupId}`);
  const existing = await prisma.sponsorFeedback.findUnique({ where: { groupId: membership.groupId } });
  await prisma.$transaction(async (tx) => {
    const row = existing
      ? await tx.sponsorFeedback.update({ where: { id: existing.id }, data: { sealUrl: stored.url } })
      : await tx.sponsorFeedback.create({ data: { groupId: membership.groupId, sealUrl: stored.url } });
    await logAction(
      { userId: actor.id, action: "SPONSOR_SEAL", entity: "SponsorFeedback", entityId: row.id, after: { url: stored.url } },
      tx,
    );
  });
  return stored.url;
}
