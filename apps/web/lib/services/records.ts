import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { fromJson, toJson } from "@/lib/json";
import { saveDocument } from "@/lib/upload";
import { CHECKLIST_ITEMS } from "@/lib/constants";
import {
  checklistSchema,
  checklistTermSchema,
  competitionSchema,
  contentSchema,
  noteSchema,
  paperSchema,
  recordIdSchema,
} from "@/lib/validation/records";
import { notifyIfReadyForPdf } from "@/lib/services/notifications";
import type { Role } from "@/lib/roles";

/**
 * Independent records (F12): competition entries, paper publications,
 * submission checklists, RTM / cost content pages and notes.
 *
 * Only students belonging to the group may write them (any status except a
 * generated final PDF — unlike topics and charts these unlock before ACTIVE).
 * Guides and the HOD see everything read-only. Every write audits.
 */

export type RecordsActor = { id: string; role: Role };

async function myStudentGroup(actor: RecordsActor) {
  if (actor.role !== "STUDENT") {
    throw new AppError("FORBIDDEN", "Only students of the group can edit these records");
  }
  const membership = await prisma.groupMember.findFirst({
    where: { userId: actor.id },
    include: { group: true },
  });
  if (!membership) throw new AppError("NO_GROUP", "You are not in a group yet");
  if (membership.group.status === "PDF_GENERATED") {
    throw new AppError("LOCKED", "The log book is locked after the final PDF is generated");
  }
  return membership.group;
}

async function ownedCompetition(actor: RecordsActor, id: string) {
  const group = await myStudentGroup(actor);
  const entry = await prisma.competition.findUnique({ where: { id } });
  if (!entry || entry.groupId !== group.id) {
    throw new AppError("NOT_FOUND", "That competition entry does not belong to your group");
  }
  return { group, entry };
}

async function ownedPaper(actor: RecordsActor, id: string) {
  const group = await myStudentGroup(actor);
  const entry = await prisma.paperPublication.findUnique({ where: { id } });
  if (!entry || entry.groupId !== group.id) {
    throw new AppError("NOT_FOUND", "That paper does not belong to your group");
  }
  return { group, entry };
}

async function ownedNote(actor: RecordsActor, id: string) {
  const group = await myStudentGroup(actor);
  const entry = await prisma.contentPage.findUnique({ where: { id } });
  if (!entry || entry.groupId !== group.id || entry.type !== "NOTE") {
    throw new AppError("NOT_FOUND", "That note does not belong to your group");
  }
  return { group, entry };
}

// ---------------------------------------------------------------- competitions

export async function listCompetitions(groupId: string) {
  return prisma.competition.findMany({ where: { groupId }, orderBy: { createdAt: "asc" } });
}

export async function saveCompetition(actor: RecordsActor, input: unknown) {
  const parsed = competitionSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
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
  if (!parsed.success) throw new AppError("INVALID_INPUT", "Invalid input");
  const { entry } = await ownedCompetition(actor, parsed.data.id);
  await prisma.$transaction(async (tx) => {
    await tx.competition.delete({ where: { id: entry.id } });
    await logAction(
      { userId: actor.id, action: "COMPETITION_DELETE", entity: "Competition", entityId: entry.id, before: { name: entry.name } },
      tx,
    );
  });
}

export async function uploadCertificate(actor: RecordsActor, file: File, id: string) {
  const { entry } = await ownedCompetition(actor, id);
  const stored = await saveDocument(file, "certificates", `cert-${entry.id}`);
  await prisma.$transaction(async (tx) => {
    await tx.competition.update({ where: { id: entry.id }, data: { certificateUrl: stored.url } });
    await logAction(
      { userId: actor.id, action: "COMPETITION_CERTIFICATE", entity: "Competition", entityId: entry.id, after: { url: stored.url } },
      tx,
    );
  });
  return stored.url;
}

// ---------------------------------------------------------------- papers

export async function listPapers(groupId: string) {
  return prisma.paperPublication.findMany({ where: { groupId }, orderBy: { createdAt: "asc" } });
}

export async function savePaper(actor: RecordsActor, input: unknown) {
  const parsed = paperSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
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
  if (!parsed.success) throw new AppError("INVALID_INPUT", "Invalid input");
  const { entry } = await ownedPaper(actor, parsed.data.id);
  await prisma.$transaction(async (tx) => {
    await tx.paperPublication.delete({ where: { id: entry.id } });
    await logAction(
      { userId: actor.id, action: "PAPER_DELETE", entity: "PaperPublication", entityId: entry.id, before: { title: entry.title } },
      tx,
    );
  });
}

export async function uploadPaperFile(actor: RecordsActor, file: File, id: string) {
  const { entry } = await ownedPaper(actor, id);
  const stored = await saveDocument(file, "papers", `paper-${entry.id}`);
  await prisma.$transaction(async (tx) => {
    await tx.paperPublication.update({ where: { id: entry.id }, data: { fileUrl: stored.url } });
    await logAction(
      { userId: actor.id, action: "PAPER_FILE", entity: "PaperPublication", entityId: entry.id, after: { url: stored.url } },
      tx,
    );
  });
  return stored.url;
}

// ---------------------------------------------------------------- checklists

export type ChecklistData = { term: string; items: { text: string; checked: boolean }[] };

export async function getChecklist(groupId: string, term: string): Promise<ChecklistData> {
  const parsed = checklistTermSchema.safeParse(term);
  if (!parsed.success) throw new AppError("INVALID_INPUT", "Unknown checklist term");
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
    throw new AppError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
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

export async function getContentPage(groupId: string, type: "RTM" | "COST") {
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
    throw new AppError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
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

export async function uploadContentFile(actor: RecordsActor, file: File, type: "RTM" | "COST") {
  if (type !== "RTM" && type !== "COST") throw new AppError("INVALID_INPUT", "Unknown page");
  const group = await myStudentGroup(actor);
  const stored = await saveDocument(file, "content", `${type.toLowerCase()}-${group.id}`);
  const existing = await prisma.contentPage.findUnique({
    where: { groupId_type_sortOrder: { groupId: group.id, type, sortOrder: 0 } },
  });
  await prisma.$transaction(async (tx) => {
    const saved = existing
      ? await tx.contentPage.update({ where: { id: existing.id }, data: { fileUrl: stored.url } })
      : await tx.contentPage.create({ data: { groupId: group.id, type, sortOrder: 0, fileUrl: stored.url } });
    await logAction(
      { userId: actor.id, action: "CONTENT_FILE", entity: "ContentPage", entityId: saved.id, after: { type, url: stored.url } },
      tx,
    );
  });
  return stored.url;
}

// ---------------------------------------------------------------- notes

export async function listNotes(groupId: string) {
  return prisma.contentPage.findMany({
    where: { groupId, type: "NOTE" },
    orderBy: { sortOrder: "asc" },
  });
}

export async function saveNote(actor: RecordsActor, input: unknown) {
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
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
  if (!parsed.success) throw new AppError("INVALID_INPUT", "Invalid input");
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

/** Everything on the F12 sheets for one group, read-only for the HOD. */
export async function getGroupRecords(groupId: string): Promise<GroupRecords> {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw new AppError("GROUP_NOT_FOUND", "Group not found");
  const [competitions, papers, termI, termII, rtm, cost, notes] = await Promise.all([
    listCompetitions(groupId),
    listPapers(groupId),
    getChecklist(groupId, "TERM_I"),
    getChecklist(groupId, "TERM_II"),
    getContentPage(groupId, "RTM"),
    getContentPage(groupId, "COST"),
    listNotes(groupId),
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

/** Every group, for the HOD records index. */
export async function listRecordsQueue() {
  return prisma.group.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      guide: { select: { name: true } },
      _count: { select: { competitions: true, papers: true } },
    },
  });
}
