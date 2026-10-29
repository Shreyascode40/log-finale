import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db.js";
import { fromJson, toJson } from "../json.js";
import { ApiDomainError } from "../errors.js";
import {
  CHECKLIST_ITEMS,
  COMPETITION_TYPES,
  RECORD_CONTENT_TYPES,
} from "../constants.js";
import { notifyIfReadyForPdf } from "./notifications.js";

export type RecordsActor = { id: string; role: string; name?: string };

const MAX_DOC_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_DOC_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;

const idSchema = z.string().min(1);
const shortText = (max: number, label: string) =>
  z.string().trim().max(max, `${label} is too long`).default("");

export const competitionSchema = z.object({
  id: idSchema.optional(),
  name: z.string().trim().min(1, "Enter the competition name").max(200, "Name is too long"),
  date: shortText(60, "Date"),
  collegeAndLevel: shortText(200, "College and level"),
  type: z.enum(COMPETITION_TYPES).nullable().optional(),
  award: shortText(200, "Award / participation"),
});

export const paperSchema = z.object({
  id: idSchema.optional(),
  title: z.string().trim().min(1, "Enter the paper title").max(300, "Title is too long"),
  conference: shortText(200, "Conference"),
  issn: shortText(40, "ISSN"),
  volIssue: shortText(40, "Volume / issue"),
  pageNo: shortText(40, "Page number"),
});

export const recordIdSchema = z.object({ id: idSchema });

export const checklistTermSchema = z.enum(["TERM_I", "TERM_II"]);
export type ChecklistTerm = z.infer<typeof checklistTermSchema>;

export const checklistSchema = z
  .object({
    term: checklistTermSchema,
    checks: z.array(z.boolean()),
  })
  .refine((value) => value.checks.length === CHECKLIST_ITEMS[value.term].length, {
    message: "Tick every checklist item",
    path: ["checks"],
  });

export const contentSchema = z.object({
  type: z.enum(RECORD_CONTENT_TYPES),
  richText: z.string().trim().max(20000, "Content is too long").default(""),
});

export const noteSchema = z.object({
  id: idSchema.optional(),
  text: z.string().trim().min(1, "Write the note first").max(5000, "Note is too long"),
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

async function persistDocument(
  bytes: Buffer,
  contentType: string,
  subdir: string,
  baseName: string,
): Promise<string> {
  if (!ALLOWED_DOC_TYPES.includes(contentType as (typeof ALLOWED_DOC_TYPES)[number])) {
    throw new ApiDomainError("INVALID_FILE", "Only PDF, JPG or PNG files can be uploaded", 400);
  }
  if (bytes.byteLength > MAX_DOC_BYTES) {
    throw new ApiDomainError("FILE_TOO_BIG", "Files must be at most 10 MB", 400);
  }
  const ext = contentType === "application/pdf" ? "pdf" : contentType === "image/png" ? "png" : "jpg";
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
    if (!upload.ok) throw new ApiDomainError("UPLOAD_FAILED", "Document upload failed.", 502);
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

async function myStudentGroup(actor: RecordsActor) {
  if (actor.role !== "STUDENT") {
    throw new ApiDomainError("FORBIDDEN", "Only students of the group can edit these records", 403);
  }
  const membership = await prisma.groupMember.findFirst({
    where: { userId: actor.id },
    include: { group: true },
  });
  if (!membership) throw new ApiDomainError("NO_GROUP", "You are not in a group yet", 404);
  if (membership.group.status === "PDF_GENERATED") {
    throw new ApiDomainError("LOCKED", "The log book is locked after the final PDF is generated", 409);
  }
  return membership.group;
}

async function ownedCompetition(actor: RecordsActor, id: string) {
  const group = await myStudentGroup(actor);
  const entry = await prisma.competition.findUnique({ where: { id } });
  if (!entry || entry.groupId !== group.id) {
    throw new ApiDomainError("NOT_FOUND", "That competition entry does not belong to your group", 404);
  }
  return { group, entry };
}

async function ownedPaper(actor: RecordsActor, id: string) {
  const group = await myStudentGroup(actor);
  const entry = await prisma.paperPublication.findUnique({ where: { id } });
  if (!entry || entry.groupId !== group.id) {
    throw new ApiDomainError("NOT_FOUND", "That paper does not belong to your group", 404);
  }
  return { group, entry };
}

async function ownedNote(actor: RecordsActor, id: string) {
  const group = await myStudentGroup(actor);
  const entry = await prisma.contentPage.findUnique({ where: { id } });
  if (!entry || entry.groupId !== group.id || entry.type !== "NOTE") {
    throw new ApiDomainError("NOT_FOUND", "That note does not belong to your group", 404);
  }
  return { group, entry };
}

// ---------------------------------------------------------------- competitions

export async function listCompetitions(
  actorOrGroupId: RecordsActor | string,
  maybeGroupId?: string,
) {
  const groupId = typeof actorOrGroupId === "string" ? actorOrGroupId : maybeGroupId!;
  return prisma.competition.findMany({ where: { groupId }, orderBy: { createdAt: "asc" } });
}

export async function saveCompetition(actor: RecordsActor, input: unknown) {
  const parsed = competitionSchema.safeParse(input);
  if (!parsed.success) {
    throw new ApiDomainError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  const { id, name, date, collegeAndLevel, type, award } = parsed.data;
  const data = {
    name,
    date: date || null,
    collegeAndLevel: collegeAndLevel || null,
    type: type ?? null,
    award: award || null,
  };

  if (id) {
    const { entry } = await ownedCompetition(actor, id);
    const before = { name: entry.name, date: entry.date, award: entry.award };
    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.competition.update({ where: { id: entry.id }, data });
      await logAction(
        { userId: actor.id, action: "COMPETITION_UPDATE", entity: "Competition", entityId: saved.id, before, after: data },
        tx,
      );
      return saved;
    });
    return updated;
  }

  const group = await myStudentGroup(actor);
  const created = await prisma.$transaction(async (tx) => {
    const saved = await tx.competition.create({ data: { groupId: group.id, ...data } });
    await logAction(
      { userId: actor.id, action: "COMPETITION_CREATE", entity: "Competition", entityId: saved.id, after: data },
      tx,
    );
    return saved;
  });
  await notifyIfReadyForPdf(group.id);
  return created;
}

export async function deleteCompetition(actor: RecordsActor, input: unknown) {
  const parsed = recordIdSchema.safeParse(input);
  if (!parsed.success) throw new ApiDomainError("INVALID_INPUT", "Invalid input", 400);
  const { entry } = await ownedCompetition(actor, parsed.data.id);
  await prisma.$transaction(async (tx) => {
    await tx.competition.delete({ where: { id: entry.id } });
    await logAction(
      { userId: actor.id, action: "COMPETITION_DELETE", entity: "Competition", entityId: entry.id, before: { name: entry.name } },
      tx,
    );
  });
}

export async function uploadCertificate(
  actor: RecordsActor,
  id: string,
  contentType: string,
  bytes: Buffer,
) {
  const { entry } = await ownedCompetition(actor, id);
  const url = await persistDocument(bytes, contentType, "certificates", `cert-${entry.id}`);
  await prisma.$transaction(async (tx) => {
    await tx.competition.update({ where: { id: entry.id }, data: { certificateUrl: url } });
    await logAction(
      { userId: actor.id, action: "COMPETITION_CERTIFICATE", entity: "Competition", entityId: entry.id, after: { url } },
      tx,
    );
  });
  return url;
}

// ---------------------------------------------------------------- papers

export async function listPapers(
  actorOrGroupId: RecordsActor | string,
  maybeGroupId?: string,
) {
  const groupId = typeof actorOrGroupId === "string" ? actorOrGroupId : maybeGroupId!;
  return prisma.paperPublication.findMany({ where: { groupId }, orderBy: { createdAt: "asc" } });
}

export async function savePaper(actor: RecordsActor, input: unknown) {
  const parsed = paperSchema.safeParse(input);
  if (!parsed.success) {
    throw new ApiDomainError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  const { id, title, conference, issn, volIssue, pageNo } = parsed.data;
  const data = {
    title,
    conference: conference || null,
    issn: issn || null,
    volIssue: volIssue || null,
    pageNo: pageNo || null,
  };

  if (id) {
    const { entry } = await ownedPaper(actor, id);
    const before = { title: entry.title, conference: entry.conference };
    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.paperPublication.update({ where: { id: entry.id }, data });
      await logAction(
        { userId: actor.id, action: "PAPER_UPDATE", entity: "PaperPublication", entityId: saved.id, before, after: data },
        tx,
      );
      return saved;
    });
    return updated;
  }

  const group = await myStudentGroup(actor);
  const created = await prisma.$transaction(async (tx) => {
    const saved = await tx.paperPublication.create({ data: { groupId: group.id, ...data } });
    await logAction(
      { userId: actor.id, action: "PAPER_CREATE", entity: "PaperPublication", entityId: saved.id, after: data },
      tx,
    );
    return saved;
  });
  await notifyIfReadyForPdf(group.id);
  return created;
}

export async function deletePaper(actor: RecordsActor, input: unknown) {
  const parsed = recordIdSchema.safeParse(input);
  if (!parsed.success) throw new ApiDomainError("INVALID_INPUT", "Invalid input", 400);
  const { entry } = await ownedPaper(actor, parsed.data.id);
  await prisma.$transaction(async (tx) => {
    await tx.paperPublication.delete({ where: { id: entry.id } });
    await logAction(
      { userId: actor.id, action: "PAPER_DELETE", entity: "PaperPublication", entityId: entry.id, before: { title: entry.title } },
      tx,
    );
  });
}

export async function uploadPaperFile(
  actor: RecordsActor,
  id: string,
  contentType: string,
  bytes: Buffer,
) {
  const { entry } = await ownedPaper(actor, id);
  const url = await persistDocument(bytes, contentType, "papers", `paper-${entry.id}`);
  await prisma.$transaction(async (tx) => {
    await tx.paperPublication.update({ where: { id: entry.id }, data: { fileUrl: url } });
    await logAction(
      { userId: actor.id, action: "PAPER_FILE", entity: "PaperPublication", entityId: entry.id, after: { url } },
      tx,
    );
  });
  return url;
}

// ---------------------------------------------------------------- checklists

export type ChecklistData = { term: string; items: { text: string; checked: boolean }[] };

export async function getChecklist(
  actorOrGroupId: RecordsActor | string,
  groupIdOrTerm: string,
  maybeTerm?: string,
): Promise<ChecklistData> {
  const groupId = typeof actorOrGroupId === "string" ? actorOrGroupId : groupIdOrTerm;
  const term = typeof actorOrGroupId === "string" ? groupIdOrTerm : maybeTerm!;

  const parsed = checklistTermSchema.safeParse(term);
  if (!parsed.success) throw new ApiDomainError("INVALID_INPUT", "Unknown checklist term", 400);
  const texts = CHECKLIST_ITEMS[parsed.data];

  const row = await prisma.checklist.upsert({
    where: { groupId_term: { groupId, term: parsed.data } },
    update: {},
    create: {
      groupId,
      term: parsed.data,
      items: toJson(texts.map((text) => ({ text, checked: false }))),
    },
  });
  const saved = fromJson<{ text: string; checked: boolean }[]>(row.items, []);
  const byText = new Map(saved.map((item) => [item.text, item.checked]));
  return {
    term: parsed.data,
    items: texts.map((text) => ({ text, checked: byText.get(text) ?? false })),
  };
}

export async function setChecklist(actor: RecordsActor, input: unknown) {
  const parsed = checklistSchema.safeParse(input);
  if (!parsed.success) {
    throw new ApiDomainError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  const group = await myStudentGroup(actor);
  const texts = CHECKLIST_ITEMS[parsed.data.term];
  const items = texts.map((text, index) => ({ text, checked: parsed.data.checks[index] ?? false }));

  const existing = await prisma.checklist.findUnique({
    where: { groupId_term: { groupId: group.id, term: parsed.data.term } },
  });
  await prisma.$transaction(async (tx) => {
    const saved = existing
      ? await tx.checklist.update({
          where: { id: existing.id },
          data: { items: toJson(items) },
        })
      : await tx.checklist.create({
          data: { groupId: group.id, term: parsed.data.term, items: toJson(items) },
        });
    await logAction(
      {
        userId: actor.id,
        action: "CHECKLIST_SAVE",
        entity: "Checklist",
        entityId: saved.id,
        before: existing ? { items: existing.items } : null,
        after: { term: parsed.data.term, checked: items.filter((item) => item.checked).length },
      },
      tx,
    );
  });
  await notifyIfReadyForPdf(group.id);
  return items;
}

// ---------------------------------------------------------------- RTM / cost pages

export async function getContentPage(
  actorOrGroupId: RecordsActor | string,
  groupIdOrType: string,
  maybeType?: "RTM" | "COST",
) {
  const groupId = typeof actorOrGroupId === "string" ? actorOrGroupId : groupIdOrType;
  const type = (typeof actorOrGroupId === "string" ? groupIdOrType : maybeType!) as "RTM" | "COST";

  const row = await prisma.contentPage.upsert({
    where: { groupId_type_sortOrder: { groupId, type, sortOrder: 0 } },
    update: {},
    create: { groupId, type, sortOrder: 0 },
  });
  return row;
}

export async function saveContent(actor: RecordsActor, input: unknown) {
  const parsed = contentSchema.safeParse(input);
  if (!parsed.success) {
    throw new ApiDomainError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  const group = await myStudentGroup(actor);
  const existing = await prisma.contentPage.findUnique({
    where: { groupId_type_sortOrder: { groupId: group.id, type: parsed.data.type, sortOrder: 0 } },
  });
  const updated = await prisma.$transaction(async (tx) => {
    const saved = existing
      ? await tx.contentPage.update({
          where: { id: existing.id },
          data: { richText: parsed.data.richText || null },
        })
      : await tx.contentPage.create({
          data: { groupId: group.id, type: parsed.data.type, sortOrder: 0, richText: parsed.data.richText || null },
        });
    await logAction(
      { userId: actor.id, action: "CONTENT_SAVE", entity: "ContentPage", entityId: saved.id, after: { type: parsed.data.type } },
      tx,
    );
    return saved;
  });
  await notifyIfReadyForPdf(group.id);
  return updated;
}

export async function uploadContentFile(
  actor: RecordsActor,
  type: "RTM" | "COST",
  contentType: string,
  bytes: Buffer,
) {
  if (type !== "RTM" && type !== "COST") throw new ApiDomainError("INVALID_INPUT", "Unknown page", 400);
  const group = await myStudentGroup(actor);
  const url = await persistDocument(bytes, contentType, "content", `${type.toLowerCase()}-${group.id}`);
  const existing = await prisma.contentPage.findUnique({
    where: { groupId_type_sortOrder: { groupId: group.id, type, sortOrder: 0 } },
  });
  await prisma.$transaction(async (tx) => {
    const saved = existing
      ? await tx.contentPage.update({ where: { id: existing.id }, data: { fileUrl: url } })
      : await tx.contentPage.create({ data: { groupId: group.id, type, sortOrder: 0, fileUrl: url } });
    await logAction(
      { userId: actor.id, action: "CONTENT_FILE", entity: "ContentPage", entityId: saved.id, after: { type, url } },
      tx,
    );
  });
  return url;
}

// ---------------------------------------------------------------- notes

export async function listNotes(
  actorOrGroupId: RecordsActor | string,
  maybeGroupId?: string,
) {
  const groupId = typeof actorOrGroupId === "string" ? actorOrGroupId : maybeGroupId!;
  return prisma.contentPage.findMany({
    where: { groupId, type: "NOTE" },
    orderBy: { sortOrder: "asc" },
  });
}

export async function saveNote(actor: RecordsActor, input: unknown) {
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) {
    throw new ApiDomainError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  const { id, text } = parsed.data;

  if (id) {
    const { entry } = await ownedNote(actor, id);
    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.contentPage.update({ where: { id: entry.id }, data: { richText: text } });
      await logAction(
        { userId: actor.id, action: "NOTE_UPDATE", entity: "ContentPage", entityId: saved.id, before: { text: entry.richText }, after: { text } },
        tx,
      );
      return saved;
    });
    return updated;
  }

  const group = await myStudentGroup(actor);
  const maxSort = await prisma.contentPage.findFirst({
    where: { groupId: group.id, type: "NOTE" },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const created = await prisma.$transaction(async (tx) => {
    const saved = await tx.contentPage.create({
      data: { groupId: group.id, type: "NOTE", sortOrder: (maxSort?.sortOrder ?? -1) + 1, richText: text },
    });
    await logAction(
      { userId: actor.id, action: "NOTE_CREATE", entity: "ContentPage", entityId: saved.id, after: { text } },
      tx,
    );
    return saved;
  });
  return created;
}

export async function deleteNote(actor: RecordsActor, input: unknown) {
  const parsed = recordIdSchema.safeParse(input);
  if (!parsed.success) throw new ApiDomainError("INVALID_INPUT", "Invalid input", 400);
  const { entry } = await ownedNote(actor, parsed.data.id);
  await prisma.$transaction(async (tx) => {
    await tx.contentPage.delete({ where: { id: entry.id } });
    await logAction(
      { userId: actor.id, action: "NOTE_DELETE", entity: "ContentPage", entityId: entry.id, before: { text: entry.richText } },
      tx,
    );
  });
}

// ---------------------------------------------------------------- HOD bundle

export type GroupRecords = {
  group: { id: string; groupNo: string | null; projectTitle: string | null; status: string };
  competitions: Awaited<ReturnType<typeof listCompetitions>>;
  papers: Awaited<ReturnType<typeof listPapers>>;
  checklists: ChecklistData[];
  rtm: Awaited<ReturnType<typeof getContentPage>>;
  cost: Awaited<ReturnType<typeof getContentPage>>;
  notes: Awaited<ReturnType<typeof listNotes>>;
};

export async function getGroupRecords(actor: RecordsActor, groupId: string): Promise<GroupRecords> {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw new ApiDomainError("GROUP_NOT_FOUND", "Group not found", 404);
  const [competitions, papers, termI, termII, rtm, cost, notes] = await Promise.all([
    listCompetitions(actor, groupId),
    listPapers(actor, groupId),
    getChecklist(actor, groupId, "TERM_I"),
    getChecklist(actor, groupId, "TERM_II"),
    getContentPage(actor, groupId, "RTM"),
    getContentPage(actor, groupId, "COST"),
    listNotes(actor, groupId),
  ]);
  return {
    group: { id: group.id, groupNo: group.groupNo ?? null, projectTitle: group.projectTitle ?? null, status: group.status },
    competitions,
    papers,
    checklists: [termI, termII],
    rtm,
    cost,
    notes,
  };
}

export async function listRecordsQueue(actor: RecordsActor) {
  if (actor.role !== "HOD") {
    throw new ApiDomainError("FORBIDDEN", "Only the HOD can view records queue", 403);
  }
  return prisma.group.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      guide: { select: { name: true } },
      _count: { select: { competitions: true, papers: true } },
    },
  });
}
