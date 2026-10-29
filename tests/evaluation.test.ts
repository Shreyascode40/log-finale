import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import type { Role } from "@/lib/roles";
import {
  approveMockSheets,
  getMockSheet,
  saveMockSheets,
  submitMockSheets,
  unlockMockSheets,
} from "../apps/api/src/modules/evaluation";
import { getExaminerSheet, saveExaminerFeedback } from "../apps/api/src/modules/examiner";

/**
 * F11 — Mock Evaluation (50) and Examiner Feedback Term-I. Proves the
 * server-computed totals, the per-cell maxima, the guide-only writes, the
 * approval lock with HOD-only unlock, and the examiner transcription, against
 * the throwaway test database.
 */

type Actor = { id: string; role: Role; name: string };

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
  return { id: user.id, role: user.role as Role, name: user.name };
}

async function makeGroup(creator: Actor, guide: Actor | null, status = "ACTIVE") {
  const group = await prisma.group.create({
    data: {
      code: `C${rid()}`,
      groupNo: `G${rid()}`,
      projectTitle: "Vitest mock project",
      status,
      creatorId: creator.id,
      guideId: guide?.id ?? null,
    },
  });
  createdGroupIds.push(group.id);
  await prisma.groupMember.create({
    data: { groupId: group.id, userId: creator.id, name: creator.name, memberType: "creator" },
  });
  return group;
}

async function memberId(groupId: string): Promise<string> {
  const sheet = await getMockSheet(groupId);
  const row = sheet.rows[0];
  if (!row) throw new Error("no mock rows materialized");
  return row.memberId;
}

const fullMarks = (id: string) => ({
  memberId: id,
  components: {
    problem: 5,
    literature: 5,
    analysis: 5,
    modeling: 10,
    planning: 5,
    presentation: 10,
    report: 10,
  },
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.group.deleteMany({ where: { id: { in: createdGroupIds } } });
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
});

describe("mock totals are computed on the server", () => {
  it("sums the cells and refuses an over-max cell", async () => {
    const guide = await makeUser("GUIDE", "m-guide");
    const student = await makeUser("STUDENT", "m-student");
    const group = await makeGroup(student, guide);
    const id = await memberId(group.id);

    await saveMockSheets(guide, { groupId: group.id, rows: [fullMarks(id)] });
    const sheet = await getMockSheet(group.id);
    expect(sheet.rows[0]?.total).toBe(50);

    await expect(
      saveMockSheets(guide, {
        groupId: group.id,
        rows: [{ memberId: id, components: { problem: 6 } }],
      }),
    ).rejects.toThrow(/above 5/);

    // partial cells sum what is present
    await saveMockSheets(guide, {
      groupId: group.id,
      rows: [{ memberId: id, components: { problem: 3, modeling: 7 } }],
    });
    const partial = await getMockSheet(group.id);
    expect(partial.rows[0]?.total).toBe(10);
  });
});

describe("mock writes are guide-only", () => {
  it("refuses students, the HOD and guides of other groups", async () => {
    const guide = await makeUser("GUIDE", "m-guide");
    const otherGuide = await makeUser("GUIDE", "m-guide2");
    const hod = await makeUser("HOD", "m-hod");
    const student = await makeUser("STUDENT", "m-student");
    const group = await makeGroup(student, guide);
    const id = await memberId(group.id);
    const input = { groupId: group.id, rows: [fullMarks(id)] };

    await expect(saveMockSheets(student, input)).rejects.toThrow(/Only the project guide/);
    await expect(saveMockSheets(hod, input)).rejects.toThrow(/Only the project guide/);
    await expect(saveMockSheets(otherGuide, input)).rejects.toThrow(
      /guide assigned to this group/,
    );
  });

  it("refuses a member row from another group", async () => {
    const guide = await makeUser("GUIDE", "m-guide");
    const student = await makeUser("STUDENT", "m-student");
    const group = await makeGroup(student, guide);
    await memberId(group.id);

    const stranger = await makeUser("STUDENT", "m-stranger");
    const otherGroup = await makeGroup(stranger, null);
    const strangerMember = await prisma.groupMember.findFirstOrThrow({
      where: { groupId: otherGroup.id },
    });

    await expect(
      saveMockSheets(guide, {
        groupId: group.id,
        rows: [fullMarks(strangerMember.id)],
      }),
    ).rejects.toThrow(/does not belong to this group/);
  });
});

describe("mock submit / approve / unlock", () => {
  it("locks approved rows and only the HOD unlocks with a reason", async () => {
    const guide = await makeUser("GUIDE", "m-guide");
    const hod = await makeUser("HOD", "m-hod");
    const student = await makeUser("STUDENT", "m-student");
    const group = await makeGroup(student, guide);
    const id = await memberId(group.id);

    await saveMockSheets(guide, { groupId: group.id, rows: [fullMarks(id)] });
    await submitMockSheets(guide, { groupId: group.id });

    let sheet = await getMockSheet(group.id);
    expect(sheet.rows[0]?.status).toBe("SUBMITTED");
    expect(sheet.submittedSign.name).toBe(guide.name);

    await expect(
      saveMockSheets(guide, { groupId: group.id, rows: [fullMarks(id)] }),
    ).rejects.toThrow(/Only draft mark sheets can be edited/);

    await approveMockSheets(hod, { groupId: group.id });
    sheet = await getMockSheet(group.id);
    expect(sheet.rows[0]?.status).toBe("APPROVED");
    expect(sheet.rows[0]?.approvedByName).toBe(hod.name);

    await expect(
      unlockMockSheets(guide, { groupId: group.id, reason: "fix" }),
    ).rejects.toThrow(/Only the Head of Department/);
    await expect(unlockMockSheets(hod, { groupId: group.id, reason: "" })).rejects.toThrow(
      /reason is required/i,
    );

    await unlockMockSheets(hod, { groupId: group.id, reason: "Recheck totals" });
    sheet = await getMockSheet(group.id);
    expect(sheet.rows[0]?.status).toBe("DRAFT");
    expect(sheet.rows[0]?.unlockReason).toBe("Recheck totals");
  });

  it("audits every transition per row", async () => {
    const guide = await makeUser("GUIDE", "m-guide");
    const hod = await makeUser("HOD", "m-hod");
    const student = await makeUser("STUDENT", "m-student");
    const group = await makeGroup(student, guide);
    const id = await memberId(group.id);

    await saveMockSheets(guide, { groupId: group.id, rows: [fullMarks(id)] });
    await submitMockSheets(guide, { groupId: group.id });
    await approveMockSheets(guide, { groupId: group.id });

    const row = await prisma.marksSheet.findFirstOrThrow({
      where: { groupId: group.id, memberId: id, kind: "MOCK_T1" },
    });
    for (const action of ["MOCK_SAVE", "MOCK_SUBMIT", "MOCK_APPROVE"]) {
      const audit = await prisma.auditLog.findFirst({ where: { action, entityId: row.id } });
      expect(audit).not.toBeNull();
    }
    expect(hod).toBeDefined();
  });
});

describe("examiner feedback Term-I", () => {
  const answers = [
    "Excellent",
    "Good",
    "Satisfactory",
    "Good",
    "Excellent",
    "Good",
    "Satisfactory",
    "Good",
    "Excellent",
  ] as const;

  it("lets the assigned guide record all 9 ratings and signs internally", async () => {
    const guide = await makeUser("GUIDE", "m-guide");
    const student = await makeUser("STUDENT", "m-student");
    const group = await makeGroup(student, guide);

    await saveExaminerFeedback(guide, {
      groupId: group.id,
      term: "TERM_I",
      projectTitle: "Vitest project",
      date: "10 Nov 2025",
      answers: [...answers],
      remarks: "Good demonstration",
      externalName: "Dr. External",
    });

    const sheet = await getExaminerSheet(group.id, "TERM_I");
    expect(sheet.answers).toEqual([...answers]);
    expect(sheet.remarks).toBe("Good demonstration");
    expect(sheet.externalName).toBe("Dr. External");
    expect(sheet.internalName).toBe(guide.name);
    expect(sheet.signedAt).not.toBeNull();
  });

  it("refuses students, the HOD, other guides and incomplete ratings", async () => {
    const guide = await makeUser("GUIDE", "m-guide");
    const otherGuide = await makeUser("GUIDE", "m-guide2");
    const hod = await makeUser("HOD", "m-hod");
    const student = await makeUser("STUDENT", "m-student");
    const group = await makeGroup(student, guide);
    const base = {
      groupId: group.id,
      term: "TERM_I" as const,
      projectTitle: "",
      date: "",
      answers: [...answers],
      remarks: "",
      externalName: "",
    };

    await expect(saveExaminerFeedback(student, base)).rejects.toThrow(/Only the project guide/);
    await expect(saveExaminerFeedback(hod, base)).rejects.toThrow(/Only the project guide/);
    await expect(saveExaminerFeedback(otherGuide, base)).rejects.toThrow(
      /guide assigned to this group/,
    );
    await expect(
      saveExaminerFeedback(guide, { ...base, answers: ["Excellent"] }),
    ).rejects.toThrow(/Rate all 9/);
  });
});
