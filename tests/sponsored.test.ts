import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import type { Role } from "@/lib/roles";
import { setGroupSponsored } from "@/lib/services/admin";
import {
  deleteMeeting,
  getSponsoredSheet,
  recordExternalSign,
  saveMeeting,
  saveSponsorFeedback,
  signMeetingGuide,
  signMeetingStudent,
} from "@/lib/services/sponsored";

/**
 * F14 — Sponsored project sheets. Proves the sponsored-only gate, the
 * three-way meeting signatures, edit-resets-signatures, the feedback ratings
 * and the audit trail, against the throwaway test database.
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

async function makeGroup(creator: Actor, guide: Actor | null, isSponsored: boolean) {
  const group = await prisma.group.create({
    data: {
      code: `C${rid()}`,
      groupNo: `G${rid()}`,
      projectTitle: "Vitest sponsored project",
      status: "ACTIVE",
      creatorId: creator.id,
      guideId: guide?.id ?? null,
      isSponsored,
    },
  });
  createdGroupIds.push(group.id);
  await prisma.groupMember.create({
    data: { groupId: group.id, userId: creator.id, name: creator.name, memberType: "creator" },
  });
  return group;
}

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.group.deleteMany({ where: { id: { in: createdGroupIds } } });
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
});

describe("sponsored gate", () => {
  it("refuses writes for non-sponsored groups and lets the HOD flag them", async () => {
    const hod = await makeUser("HOD", "s-hod");
    const guide = await makeUser("GUIDE", "s-guide");
    const student = await makeUser("STUDENT", "s-student");
    const group = await makeGroup(student, guide, false);

    await expect(
      saveMeeting(student, { semester: "SEMESTER_1", date: "", summaryPrev: "", summaryNext: "" }),
    ).rejects.toThrow(/Only sponsored/);
    await expect(
      saveSponsorFeedback(student, {
        company: "",
        ratings: { p1: "HIGH", p2: "HIGH", p3: "HIGH", p4: "HIGH", p5: "HIGH", p6: "HIGH", p7: "HIGH" },
      }),
    ).rejects.toThrow(/Only sponsored/);

    await expect(
      setGroupSponsored(student, { groupId: group.id, isSponsored: true }),
    ).rejects.toThrow(/Head of Department/);
    await setGroupSponsored(hod, { groupId: group.id, isSponsored: true });

    const flagged = await prisma.group.findUniqueOrThrow({ where: { id: group.id } });
    expect(flagged.isSponsored).toBe(true);

    const created = await saveMeeting(student, {
      semester: "SEMESTER_1",
      date: "05 Jul 2025",
      summaryPrev: "Kickoff",
      summaryNext: "Design",
    });
    expect(created.groupId).toBe(group.id);
    await deleteMeeting(student, { id: created.id });
  });
});

describe("meeting log signatures", () => {
  it("student signs, external is recorded, guide countersigns, edits reset", async () => {
    const guide = await makeUser("GUIDE", "s-guide");
    const otherGuide = await makeUser("GUIDE", "s-guide2");
    const hod = await makeUser("HOD", "s-hod");
    const student = await makeUser("STUDENT", "s-student");
    const group = await makeGroup(student, guide, true);

    const created = await saveMeeting(student, {
      semester: "SEMESTER_2",
      date: "10 Jan 2026",
      summaryPrev: "Built prototype",
      summaryNext: "Testing",
    });

    await expect(signMeetingGuide(guide, { id: created.id })).rejects.toThrow(
      /student must sign/,
    );
    await expect(signMeetingGuide(otherGuide, { id: created.id })).rejects.toThrow(
      /guide assigned to this group/,
    );
    await expect(signMeetingGuide(hod, { id: created.id })).rejects.toThrow(
      /Only the project guide/,
    );

    const studentSign = await signMeetingStudent(student, { id: created.id });
    expect(studentSign.name).toBe(student.name);

    await recordExternalSign(student, { id: created.id });
    const guideSign = await signMeetingGuide(guide, { id: created.id });
    expect(guideSign.name).toBe(guide.name);

    const sheet = await getSponsoredSheet(group.id);
    const sem2 = sheet.semesters.find((s) => s.semester === "SEMESTER_2")!;
    expect(sem2.rows).toHaveLength(1);
    expect(sem2.rows[0]?.studentSign?.name).toBe(student.name);
    expect(sem2.rows[0]?.externalSignAt).not.toBeNull();

    // editing clears every signature
    await saveMeeting(student, {
      id: created.id,
      semester: "SEMESTER_2",
      date: "11 Jan 2026",
      summaryPrev: "Built prototype",
      summaryNext: "Testing",
    });
    const edited = await getSponsoredSheet(group.id);
    const row = edited.semesters.find((s) => s.semester === "SEMESTER_2")!.rows[0]!;
    expect(row.studentSign).toBeNull();
    expect(row.guideSign).toBeNull();
    expect(row.externalSignAt).toBeNull();

    // other groups' rows are refused
    const stranger = await makeUser("STUDENT", "s-stranger");
    const otherGroup = await makeGroup(stranger, null, true);
    const otherRow = await saveMeeting(stranger, {
      semester: "SEMESTER_1",
      date: "",
      summaryPrev: "",
      summaryNext: "",
    });
    await expect(deleteMeeting(student, { id: otherRow.id })).rejects.toThrow(
      /does not belong/,
    );
    expect(otherGroup).toBeDefined();
  });
});

describe("sponsor feedback", () => {
  it("saves all seven ratings with an audit row and refuses bad values", async () => {
    const guide = await makeUser("GUIDE", "s-guide");
    const student = await makeUser("STUDENT", "s-student");
    const group = await makeGroup(student, guide, true);
    const full = { p1: "HIGH", p2: "MEDIUM", p3: "HIGH", p4: "MEDIUM", p5: "HIGH", p6: "HIGH", p7: "LOW" } as const;

    await saveSponsorFeedback(student, {
      company: "Acme Robotics",
      ratings: { ...full },
    });
    const sheet = await getSponsoredSheet(group.id);
    expect(sheet.feedback.company).toBe("Acme Robotics");
    expect(sheet.feedback.ratings.p7).toBe("LOW");
    expect(sheet.feedback.signedAt).not.toBeNull();

    await expect(
      saveSponsorFeedback(guide, { company: "", ratings: { ...full } }),
    ).rejects.toThrow(/Only students/);
    await expect(
      saveSponsorFeedback(student, { company: "", ratings: { ...full, p1: "SUPER" } }),
    ).rejects.toThrow();

    const feedback = await prisma.sponsorFeedback.findUniqueOrThrow({ where: { groupId: group.id } });
    expect(
      await prisma.auditLog.findFirst({ where: { action: "SPONSOR_FEEDBACK_SAVE", entityId: feedback.id } }),
    ).not.toBeNull();
  });
});
