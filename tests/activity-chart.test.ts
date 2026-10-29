import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import type { Role } from "@/lib/roles";
import type { ActivityMonth } from "@/lib/constants";
import { confirmEntry, getMonthChart, verifyEntry } from "../apps/api/src/modules/activity-chart";

/**
 * F9 — Activity charts. Proves the two-step signature (student confirms, the
 * assigned guide verifies), the verified-reset with history, and the audit
 * trail, against the throwaway test database.
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
      projectTitle: "Vitest activity project",
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

async function makeTemplate(month = "june") {
  return prisma.activityTemplate.create({
    data: { month, sortOrder: 9000 + Math.floor(Math.random() * 899), text: "Vitest activity row" },
  });
}

async function firstEntryId(groupId: string, actor: Actor, month: ActivityMonth = "june"): Promise<string> {
  const chart = await getMonthChart(actor, groupId, month);
  const entry = chart.entries[0];
  if (!entry) throw new Error("no entries materialized");
  return entry.id;
}

// The throwaway test database has no seeded templates, so this suite owns one
// June row for the entry-level tests (removed afterwards with its entries).
let suiteTemplateId = "";

beforeAll(async () => {
  const template = await prisma.activityTemplate.upsert({
    where: { month_sortOrder: { month: "june", sortOrder: 9501 } },
    update: { text: "Vitest suite activity row" },
    create: { month: "june", sortOrder: 9501, text: "Vitest suite activity row" },
  });
  suiteTemplateId = template.id;
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.group.deleteMany({ where: { id: { in: createdGroupIds } } });
  if (suiteTemplateId) {
    await prisma.activityEntry.deleteMany({ where: { templateId: suiteTemplateId } });
    await prisma.activityTemplate.deleteMany({ where: { id: suiteTemplateId } });
  }
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
});

describe("month charts materialize from templates", () => {
  it("creates one PLANNED entry per template on first open", async () => {
    const guide = await makeUser("GUIDE", "a-guide");
    const student = await makeUser("STUDENT", "a-student");
    const group = await makeGroup(student, guide);
    const template = await makeTemplate("july");

    const chart = await getMonthChart(student, group.id, "july");

    expect(chart.entries.length).toBeGreaterThanOrEqual(1);
    const row = chart.entries.find((entry) => entry.text === template.text);
    expect(row).toBeDefined();
    expect(row?.status).toBe("PLANNED");

    await prisma.activityEntry.deleteMany({ where: { templateId: template.id } });
    await prisma.activityTemplate.delete({ where: { id: template.id } });
  });

  it("refuses an unknown month", async () => {
    const guide = await makeUser("GUIDE", "a-guide");
    const student = await makeUser("STUDENT", "a-student");
    const group = await makeGroup(student, guide);

    // @ts-expect-error deliberate bad month
    await expect(getMonthChart(student, group.id, "april" as ActivityMonth)).rejects.toThrow();
  });
});

describe("student confirmation", () => {
  it("confirms a row with date + Complete and audits it", async () => {
    const guide = await makeUser("GUIDE", "a-guide");
    const student = await makeUser("STUDENT", "a-student");
    const group = await makeGroup(student, guide);
    const entryId = await firstEntryId(group.id, student);

    const result = await confirmEntry(student, {
      entryId,
      date: "12 Jul 2025",
      statusText: "COMPLETE",
    });

    expect(result.status).toBe("STUDENT_CONFIRMED");
    expect(result.studentName).toBe(student.name);

    const entry = await prisma.activityEntry.findUniqueOrThrow({ where: { id: entryId } });
    expect(entry.date).toBe("12 Jul 2025");
    expect(entry.statusText).toBe("COMPLETE");
    expect(entry.studentConfirmedById).toBe(student.id);

    const audit = await prisma.auditLog.findFirst({
      where: { action: "ENTRY_CONFIRM", entityId: entryId },
    });
    expect(audit?.userId).toBe(student.id);
  });

  it("refuses a guide, the HOD and a student of another group", async () => {
    const guide = await makeUser("GUIDE", "a-guide");
    const hod = await makeUser("HOD", "a-hod");
    const student = await makeUser("STUDENT", "a-student");
    const outsider = await makeUser("STUDENT", "a-outsider");
    const group = await makeGroup(student, guide);
    await makeGroup(outsider, null);
    const entryId = await firstEntryId(group.id, student);
    const input = { entryId, date: "", statusText: "COMPLETE" as const };

    await expect(confirmEntry(guide, input)).rejects.toThrow(/Only students/);
    await expect(confirmEntry(hod, input)).rejects.toThrow(/Only students/);
    await expect(confirmEntry(outsider, input)).rejects.toThrow(/does not belong to your group/);
  });

  it("keeps charts locked until the group is ACTIVE", async () => {
    const guide = await makeUser("GUIDE", "a-guide");
    const student = await makeUser("STUDENT", "a-student");
    const group = await makeGroup(student, guide, "SUBMITTED");
    const template = await makeTemplate("june");
    const entry = await prisma.activityEntry.create({
      data: { groupId: group.id, templateId: template.id, month: "june", status: "PLANNED" },
    });

    await expect(
      confirmEntry(student, { entryId: entry.id, date: "", statusText: "COMPLETE" }),
    ).rejects.toThrow(/unlock once the HOD approves/);

    await prisma.activityEntry.delete({ where: { id: entry.id } });
    await prisma.activityTemplate.delete({ where: { id: template.id } });
  });
});

describe("guide verification", () => {
  it("refuses an unconfirmed row, then verifies a confirmed one", async () => {
    const guide = await makeUser("GUIDE", "a-guide");
    const student = await makeUser("STUDENT", "a-student");
    const group = await makeGroup(student, guide);
    const entryId = await firstEntryId(group.id, student);

    await expect(verifyEntry(guide, { entryId })).rejects.toThrow(/must confirm/);

    await confirmEntry(student, { entryId, date: "", statusText: "INCOMPLETE" });
    const result = await verifyEntry(guide, { entryId });

    expect(result.status).toBe("GUIDE_VERIFIED");
    const entry = await prisma.activityEntry.findUniqueOrThrow({ where: { id: entryId } });
    expect(entry.guideVerifiedById).toBe(guide.id);

    const audit = await prisma.auditLog.findFirst({
      where: { action: "ENTRY_VERIFY", entityId: entryId },
    });
    expect(audit?.userId).toBe(guide.id);
  });

  it("refuses students, the HOD and guides of other groups", async () => {
    const guide = await makeUser("GUIDE", "a-guide");
    const otherGuide = await makeUser("GUIDE", "a-guide2");
    const hod = await makeUser("HOD", "a-hod");
    const student = await makeUser("STUDENT", "a-student");
    const group = await makeGroup(student, guide);
    const entryId = await firstEntryId(group.id, student);
    await confirmEntry(student, { entryId, date: "", statusText: "COMPLETE" });

    await expect(verifyEntry(student, { entryId })).rejects.toThrow(/Only the project guide/);
    await expect(verifyEntry(hod, { entryId })).rejects.toThrow(/Only the project guide/);
    await expect(verifyEntry(otherGuide, { entryId })).rejects.toThrow(
      /guide assigned to this group/,
    );
  });
});

describe("editing a verified row resets it (master rule 7)", () => {
  it("clears the guide countersign, keeps history and needs a fresh verify", async () => {
    const guide = await makeUser("GUIDE", "a-guide");
    const student = await makeUser("STUDENT", "a-student");
    const group = await makeGroup(student, guide);
    const entryId = await firstEntryId(group.id, student);

    await confirmEntry(student, { entryId, date: "01 Jul 2025", statusText: "COMPLETE" });
    await verifyEntry(guide, { entryId });

    await confirmEntry(student, { entryId, date: "02 Jul 2025", statusText: "COMPLETE" });

    const entry = await prisma.activityEntry.findUniqueOrThrow({ where: { id: entryId } });
    expect(entry.status).toBe("STUDENT_CONFIRMED");
    expect(entry.guideVerifiedAt).toBeNull();
    expect(entry.guideVerifiedById).toBeNull();
    expect(entry.date).toBe("02 Jul 2025");

    const history = await prisma.activityEntryHistory.findMany({ where: { entryId } });
    expect(history.length).toBeGreaterThanOrEqual(1);

    // the guide verifies the edited row again
    await verifyEntry(guide, { entryId });
    const reVerified = await prisma.activityEntry.findUniqueOrThrow({ where: { id: entryId } });
    expect(reVerified.status).toBe("GUIDE_VERIFIED");
  });
});
