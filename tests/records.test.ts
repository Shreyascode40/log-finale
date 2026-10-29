import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import type { Role } from "@/lib/roles";
import {
  deleteCompetition,
  deleteNote,
  deletePaper,
  getChecklist,
  getContentPage,
  listNotes,
  saveCompetition,
  saveContent,
  saveNote,
  savePaper,
  setChecklist,
} from "../apps/api/src/modules/records";

/**
 * F12 — Independent records. Proves student-only writes, group ownership,
 * checklist exactness, content/note handling and the audit trail, against the
 * throwaway test database. (File uploads ride the same ownership checks and
 * are exercised live.)
 */

type Actor = { id: string; role: Role };

const createdEmails: string[] = [];
const createdUserIds: string[] = [];
const createdGroupIds: string[] = [];

const rid = () => Math.random().toString(36).slice(2, 10);

async function makeUser(role: string, label: string): Promise<Actor> {
  const id = rid();
  const email = `${label}.${id}@apcoer.edu.in`;
  createdEmails.push(email);
  const user = await prisma.user.create({
    data: {
      name: `${label} ${id}`,
      email,
      role,
      rollNo: role === "STUDENT" ? `R${id}` : null,
      mobile: "9000000000",
      passwordHash: await hashPassword("Password@123"),
      emailVerifiedAt: new Date(),
      createdVia: role === "STUDENT" ? "SELF_SIGNUP" : "HOD_CREATED",
    },
  });
  createdUserIds.push(user.id);
  return { id: user.id, role: user.role as Role };
}

async function makeGroup(creator: Actor, status = "ACTIVE") {
  const group = await prisma.group.create({
    data: {
      code: `C${rid()}`,
      groupNo: `G${rid()}`,
      projectTitle: "Vitest records project",
      status,
      creatorId: creator.id,
    },
  });
  createdGroupIds.push(group.id);
  await prisma.groupMember.create({
    data: { groupId: group.id, userId: creator.id, name: `Member ${rid()}`, memberType: "creator" },
  });
  return group;
}

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.group.deleteMany({ where: { id: { in: createdGroupIds } } });
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
});

describe("competitions", () => {
  it("creates, updates and deletes an entry with an audit trail", async () => {
    const student = await makeUser("STUDENT", "c-student");
    const group = await makeGroup(student);

    const created = await saveCompetition(student, {
      name: "State poster contest",
      date: "10 Jan 2026",
      collegeAndLevel: "PICT, state",
      type: "POSTER",
      award: "Participation",
    });
    expect(created.groupId).toBe(group.id);

    const updated = await saveCompetition(student, {
      id: created.id,
      name: "State poster contest",
      date: "10 Jan 2026",
      collegeAndLevel: "PICT, state",
      type: "POSTER",
      award: "First prize",
    });
    expect(updated.award).toBe("First prize");

    await deleteCompetition(student, { id: created.id });
    expect(await prisma.competition.findUnique({ where: { id: created.id } })).toBeNull();

    for (const action of ["COMPETITION_CREATE", "COMPETITION_UPDATE", "COMPETITION_DELETE"]) {
      expect(
        await prisma.auditLog.findFirst({ where: { action, entityId: created.id } }),
      ).not.toBeNull();
    }
  });

  it("refuses guides, the HOD and other groups' rows", async () => {
    const guide = await makeUser("GUIDE", "c-guide");
    const hod = await makeUser("HOD", "c-hod");
    const student = await makeUser("STUDENT", "c-student");
    const group = await makeGroup(student);
    const other = await makeUser("STUDENT", "c-other");
    await makeGroup(other);

    const input = { name: "X", date: "", collegeAndLevel: "", award: "" };
    await expect(saveCompetition(guide, input)).rejects.toThrow(/Only students/);
    await expect(saveCompetition(hod, input)).rejects.toThrow(/Only students/);

    const created = await saveCompetition(student, input);
    await expect(deleteCompetition(other, { id: created.id })).rejects.toThrow(
      /does not belong to your group/,
    );
    await deleteCompetition(student, { id: created.id });
  });
});

describe("papers", () => {
  it("creates and updates a paper with an audit trail", async () => {
    const student = await makeUser("STUDENT", "p-student");
    const group = await makeGroup(student);

    const created = await savePaper(student, {
      title: "A vitest paper",
      conference: "NCET",
      issn: "1234-5678",
      volIssue: "12(3)",
      pageNo: "45-50",
    });
    expect(created.groupId).toBe(group.id);
    expect(await prisma.auditLog.findFirst({ where: { action: "PAPER_CREATE", entityId: created.id } })).not.toBeNull();

    await deletePaper(student, { id: created.id });
    expect(await prisma.auditLog.findFirst({ where: { action: "PAPER_DELETE", entityId: created.id } })).not.toBeNull();
  });

  it("requires a title and refuses outsiders", async () => {
    const guide = await makeUser("GUIDE", "p-guide");
    const student = await makeUser("STUDENT", "p-student");
    await makeGroup(student);

    await expect(savePaper(student, { title: "" })).rejects.toThrow(/title/);
    await expect(savePaper(guide, { title: "X" })).rejects.toThrow(/Only students/);
  });
});

describe("checklists", () => {
  it("materializes the static items and saves ticks exactly", async () => {
    const student = await makeUser("STUDENT", "k-student");
    const group = await makeGroup(student);

    const termI = await getChecklist(group.id, "TERM_I");
    expect(termI.items).toHaveLength(5);
    expect(termI.items.every((item) => !item.checked)).toBe(true);

    const termII = await getChecklist(group.id, "TERM_II");
    expect(termII.items).toHaveLength(8);

    const checks = [true, true, false, false, false];
    await setChecklist(student, { term: "TERM_I", checks });
    const saved = await getChecklist(group.id, "TERM_I");
    expect(saved.items.map((item) => item.checked)).toEqual(checks);

    await expect(setChecklist(student, { term: "TERM_I", checks: [true] })).rejects.toThrow(
      /every checklist item/i,
    );
  });

  it("refuses guides", async () => {
    const guide = await makeUser("GUIDE", "k-guide");
    await expect(
      setChecklist(guide, { term: "TERM_I", checks: [false, false, false, false, false] }),
    ).rejects.toThrow(/Only students/);
  });
});

describe("RTM / cost pages and notes", () => {
  it("saves page text and manages notes", async () => {
    const student = await makeUser("STUDENT", "n-student");
    const group = await makeGroup(student);

    const rtm = await getContentPage(group.id, "RTM");
    expect(rtm.type).toBe("RTM");
    await saveContent(student, { type: "RTM", richText: "REQ-1 maps to module A" });
    const reloaded = await getContentPage(group.id, "RTM");
    expect(reloaded.richText).toBe("REQ-1 maps to module A");

    const note = await saveNote(student, { text: "First note" });
    const renamed = await saveNote(student, { id: note.id, text: "Edited note" });
    expect(renamed.richText).toBe("Edited note");
    expect(await listNotes(group.id)).toHaveLength(1);

    await deleteNote(student, { id: note.id });
    expect(await listNotes(group.id)).toHaveLength(0);

    for (const action of ["CONTENT_SAVE", "NOTE_CREATE", "NOTE_UPDATE", "NOTE_DELETE"]) {
      expect(await prisma.auditLog.findFirst({ where: { action } })).not.toBeNull();
    }
  });

  it("refuses outsiders and locks after the final PDF", async () => {
    const other = await makeUser("STUDENT", "n-other");
    await makeGroup(other);
    const student = await makeUser("STUDENT", "n-student");
    const group = await makeGroup(student, "PDF_GENERATED");

    await expect(saveNote(student, { text: "x" })).rejects.toThrow(/locked/);
    const note = await prisma.contentPage.create({
      data: { groupId: group.id, type: "NOTE", sortOrder: 0, richText: "mine" },
    });
    await expect(deleteNote(other, { id: note.id })).rejects.toThrow(/does not belong/);
  });
});
