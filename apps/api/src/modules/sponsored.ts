import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db.js";
import { fromJson, toJson } from "../json.js";
import { ApiDomainError } from "../errors.js";
import {
  SPONSOR_PARAMETERS,
  SPONSOR_RATINGS,
  SPONSORED_SEMESTERS,
  type SponsoredSemester,
} from "../constants.js";
import { notifyIfReadyForPdf } from "./notifications.js";

/**
 * Sponsored project sheets (F14, SPEC.md B13).
 * Only groups flagged sponsored by the HOD use them:
 *   - meeting log per semester: students add rows (date + summaries),
 *     sign their row, record external guide sign date, guide countersigns.
 *   - sponsor feedback: 7 parameters High/Medium/Low, company name, seal upload.
 */

export type SponsoredActor = { id: string; role: string; name?: string };

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
  semester?: string;
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
  semesters: { semester: SponsoredSemester; title: string; rows: MeetingRow[] }[];
  feedback: {
    company: string;
    ratings: Record<string, string | null>;
    sealUrl: string | null;
    signedAt: string | null;
  };
};

const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png"] as const;

export const sponsoredSemesterSchema = z.enum(SPONSORED_SEMESTERS);

const idSchema = z.string().min(1);

export const meetingSchema = z.object({
  id: idSchema.optional(),
  semester: sponsoredSemesterSchema,
  date: z.string().trim().max(60, "Date is too long").default(""),
  summaryPrev: z.string().trim().max(2000, "Summary is too long").default(""),
  summaryNext: z.string().trim().max(2000, "Summary is too long").default("")
});

export const meetingIdSchema = z.object({ id: idSchema });

const ratingSchema = z.enum(SPONSOR_RATINGS);

export const sponsorFeedbackSchema = z.object({
  company: z.string().trim().max(200, "Company name is too long").default(""),
  ratings: z.object(
    Object.fromEntries(SPONSOR_PARAMETERS.map((p) => [p.key, ratingSchema])) as Record<
      string,
      typeof ratingSchema
    >,
  ),
});

export const sponsoredFlagSchema = z.object({
  groupId: z.string().min(1),
  isSponsored: z.boolean(),
});

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

async function saveUploadBuffer(
  subdir: string,
  baseName: string,
  contentType: string,
  bytes: Buffer,
): Promise<string> {
  if (!ALLOWED_PHOTO_TYPES.includes(contentType as (typeof ALLOWED_PHOTO_TYPES)[number])) {
    throw new ApiDomainError("INVALID_FILE", "The seal scan must be a JPG or PNG image", 400);
  }
  if (bytes.byteLength > MAX_PHOTO_BYTES) {
    throw new ApiDomainError("FILE_TOO_BIG", "The seal scan must be at most 2 MB", 400);
  }
  const ext = contentType === "image/png" ? "png" : "jpg";
  const safeBase = baseName.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60) || "file";
  const fileName = `${safeBase}-${Date.now()}-${randomBytes(4).toString("hex")}.${ext}`;

  if (process.env.UPLOAD_PROVIDER === "supabase") {
    const url = process.env.SUPABASE_URL ?? "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    const bucket = process.env.SUPABASE_PRIVATE_BUCKET ?? "";
    if (!url || !serviceKey || !bucket) {
      throw new ApiDomainError("UPLOAD_NOT_CONFIGURED", "Private uploads are not configured.", 500);
    }
    const objectPath = `${subdir}/${fileName}`;
    const upload = await fetch(`${url.replace(/\/$/, "")}/storage/v1/object/${encodeURIComponent(bucket)}/${objectPath}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "content-type": contentType,
        "x-upsert": "false",
      },
      body: new Uint8Array(bytes),
    });
    if (!upload.ok) throw new ApiDomainError("UPLOAD_FAILED", "Seal upload failed.", 502);
    const reference = Buffer.from(`${bucket}/${objectPath}`).toString("base64url");
    return `/api/files/${reference}.${ext}`;
  }

  if (process.env.NODE_ENV === "production") {
    throw new ApiDomainError("UPLOAD_NOT_CONFIGURED", "Set UPLOAD_PROVIDER=supabase for production file uploads.", 500);
  }
  const uploadDir = path.join(process.cwd(), "var", "uploads", subdir);
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, fileName), bytes);
  return `/media/${subdir}/${fileName}`;
}

async function myStudentGroup(actor: SponsoredActor) {
  if (actor.role !== "STUDENT") {
    throw new ApiDomainError("FORBIDDEN", "Only students of the group can edit the meeting log", 403);
  }
  const membership = await prisma.groupMember.findFirst({
    where: { userId: actor.id },
    include: { group: true },
  });
  if (!membership) throw new ApiDomainError("NO_GROUP", "You are not in a group yet", 404);
  return membership;
}

function assertSponsored(group: { isSponsored: boolean }) {
  if (!group.isSponsored) {
    throw new ApiDomainError("NOT_SPONSORED", "Only sponsored project groups use these sheets", 400);
  }
}

function assertUnlocked(group: { status: string }) {
  if (group.status === "PDF_GENERATED") {
    throw new ApiDomainError("LOCKED", "The log book is locked after the final PDF is generated", 403);
  }
}

async function ownedMeeting(actor: SponsoredActor, id: string) {
  const membership = await myStudentGroup(actor);
  const meeting = await prisma.sponsoredMeeting.findUnique({ where: { id } });
  if (!meeting || meeting.groupId !== membership.groupId) {
    throw new ApiDomainError("NOT_FOUND", "That meeting row does not belong to your group", 404);
  }
  assertSponsored(membership.group);
  assertUnlocked(membership.group);
  return { group: membership.group, meeting, membership };
}

/** The full sponsored bundle for a group (empty rows when not sponsored). */
export async function getSponsoredSheet(actor: SponsoredActor, groupId: string): Promise<SponsoredSheet>;
export async function getSponsoredSheet(groupId: string): Promise<SponsoredSheet>;
export async function getSponsoredSheet(
  actorOrGroupId: SponsoredActor | string,
  maybeGroupId?: string,
): Promise<SponsoredSheet> {
  const actor = typeof actorOrGroupId === "string" ? null : actorOrGroupId;
  const groupId = typeof actorOrGroupId === "string" ? actorOrGroupId : maybeGroupId!;

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
      if (!member) throw new ApiDomainError("FORBIDDEN", "You cannot view another group's sponsored sheet", 403);
    } else if (actor.role === "GUIDE" && group.guideId !== actor.id) {
      throw new ApiDomainError("FORBIDDEN", "Only the assigned guide can view this group's sponsored sheet", 403);
    } else if (!["STUDENT", "GUIDE", "HOD"].includes(actor.role)) {
      throw new ApiDomainError("FORBIDDEN", "You cannot view sponsored project sheets", 403);
    }
  }

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
export async function getStudentSponsoredGroupId(actor: SponsoredActor | string): Promise<string | null> {
  const userId = typeof actor === "string" ? actor : actor.id;
  const membership = await prisma.groupMember.findFirst({
    where: { userId },
    select: { groupId: true },
  });
  return membership?.groupId ?? null;
}

/** Assigned groups, for the guide countersign index. */
export async function listGuideSponsoredGroups(actor: SponsoredActor | string) {
  const guideId = typeof actor === "string" ? actor : actor.id;
  return prisma.group.findMany({
    where: { guideId },
    orderBy: { groupNo: "asc" },
    include: {
      sponsoredMeetings: { select: { id: true, guideSignedAt: true } },
    },
  });
}

/** Every group, for the HOD index (sponsored ones carry the sheets). */
export async function listSponsoredQueue(actor?: SponsoredActor) {
  if (actor && actor.role !== "HOD") {
    throw new ApiDomainError("FORBIDDEN", "Only the Head of Department can view this list", 403);
  }
  return prisma.group.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      guide: { select: { name: true } },
      sponsoredMeetings: { select: { id: true } },
    },
  });
}

export async function saveMeeting(actor: SponsoredActor, input: unknown) {
  const parsed = meetingSchema.safeParse(input);
  if (!parsed.success) {
    throw new ApiDomainError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input", 400);
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
  assertSponsored(membership.group);
  assertUnlocked(membership.group);
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
  if (!parsed.success) throw new ApiDomainError("INVALID_INPUT", "Invalid input", 400);
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
  if (!parsed.success) throw new ApiDomainError("INVALID_INPUT", "Invalid input", 400);
  const { meeting, membership } = await ownedMeeting(actor, parsed.data.id);

  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
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
    throw new ApiDomainError("FORBIDDEN", "Only the project guide can countersign the meeting log", 403);
  }
  const parsed = meetingIdSchema.safeParse(input);
  if (!parsed.success) throw new ApiDomainError("INVALID_INPUT", "Invalid input", 400);

  const meeting = await prisma.sponsoredMeeting.findUnique({
    where: { id: parsed.data.id },
    include: { group: { include: { guide: { select: { name: true } } } } },
  });
  if (!meeting) throw new ApiDomainError("NOT_FOUND", "That meeting row does not exist", 404);
  if (meeting.group.guideId !== actor.id) {
    throw new ApiDomainError("FORBIDDEN", "Only the guide assigned to this group can countersign", 403);
  }
  assertSponsored(meeting.group);
  assertUnlocked(meeting.group);
  if (!meeting.studentSignedAt) {
    throw new ApiDomainError("INVALID_STATE", "The student must sign the row before the guide countersigns", 400);
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

export async function recordExternalSign(actor: SponsoredActor, input: unknown) {
  const parsed = meetingIdSchema.safeParse(input);
  if (!parsed.success) throw new ApiDomainError("INVALID_INPUT", "Invalid input", 400);
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
  if (actor.role !== "STUDENT") {
    throw new ApiDomainError("FORBIDDEN", "Only students of the group can edit the meeting log", 403);
  }
  const parsed = sponsorFeedbackSchema.safeParse(input);
  if (!parsed.success) {
    throw new ApiDomainError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  const membership = await myStudentGroup(actor);
  assertSponsored(membership.group);
  assertUnlocked(membership.group);

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

export async function uploadSeal(
  actor: SponsoredActor,
  contentType: string,
  bytes: Buffer,
): Promise<string> {
  const membership = await myStudentGroup(actor);
  assertSponsored(membership.group);
  assertUnlocked(membership.group);

  const url = await saveUploadBuffer("seals", `seal-${membership.groupId}`, contentType, bytes);
  const existing = await prisma.sponsorFeedback.findUnique({ where: { groupId: membership.groupId } });
  await prisma.$transaction(async (tx) => {
    const row = existing
      ? await tx.sponsorFeedback.update({ where: { id: existing.id }, data: { sealUrl: url } })
      : await tx.sponsorFeedback.create({ data: { groupId: membership.groupId, sealUrl: url } });
    await logAction(
      { userId: actor.id, action: "SPONSOR_SEAL", entity: "SponsorFeedback", entityId: row.id, after: { url } },
      tx,
    );
  });
  return url;
}
