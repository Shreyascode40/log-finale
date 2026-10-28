import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import type { Role } from "@/lib/roles";
import { getSchedule, updateScheduleItem } from "@/lib/services/schedule";

/**
 * F7 — Schedule sheet. Proves the HOD-only edit rule, audit trail and grouping,
 * against the test database.
 */

type Actor = { id: string; role: Role };

const createdEmails: string[] = [];
const createdItemIds: string[] = [];

const rid = () => Math.random().toString(36).slice(2, 10);

async function makeUser(role: string, label: string): Promise<Actor> {
  const email = `${label}.${rid()}@apcoer.edu.in`;
  createdEmails.push(email);
  const user = await prisma.user.create({
    data: {
      name: `${label} ${rid()}`,
      email,
      role,
      mobile: "9000000000",
      passwordHash: await hashPassword("Password@123"),
      emailVerifiedAt: new Date(),
      createdVia: role === "STUDENT" ? "SELF_SIGNUP" : "HOD_CREATED",
    },
  });
  return { id: user.id, role: user.role as Role };
}

async function makeItem(term: string) {
  const item = await prisma.scheduleItem.create({
    data: {
      term,
      sortOrder: 9000 + createdItemIds.length,
      description: "Vitest schedule row",
    },
  });
  createdItemIds.push(item.id);
  return item;
}

let hod: Actor;
let student: Actor;
let guide: Actor;

beforeAll(async () => {
  [hod, student, guide] = await Promise.all([
    makeUser("HOD", "sched-hod"),
    makeUser("STUDENT", "sched-student"),
    makeUser("GUIDE", "sched-guide"),
  ]);
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { entityId: { in: createdItemIds } } });
  await prisma.scheduleItem.deleteMany({ where: { id: { in: createdItemIds } } });
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
});

describe("schedule editing is HOD-only", () => {
  it("lets the HOD set a date and writes an audit row", async () => {
    const item = await makeItem("SEMESTER_I");

    await updateScheduleItem(hod, { id: item.id, date: "05 Aug 2025", note: "" });

    const updated = await prisma.scheduleItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(updated.date).toBe("05 Aug 2025");

    const audit = await prisma.auditLog.findFirst({
      where: { action: "SCHEDULE_UPDATE", entityId: item.id },
    });
    expect(audit).not.toBeNull();
    expect(audit?.userId).toBe(hod.id);
    expect(JSON.parse(audit!.after ?? "{}")).toMatchObject({ date: "05 Aug 2025" });
  });

  it("refuses a student", async () => {
    const item = await makeItem("SEMESTER_I");
    await expect(updateScheduleItem(student, { id: item.id, date: "x", note: "" })).rejects.toThrow(
      /Only the Head of Department/,
    );
    const untouched = await prisma.scheduleItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(untouched.date).toBeNull();
  });

  it("refuses a guide", async () => {
    const item = await makeItem("SEMESTER_II");

    await expect(
      updateScheduleItem(guide, { id: item.id, date: "12 Feb 2026", note: "" }),
    ).rejects.toThrow(/Only the Head of Department/);

    const updated = await prisma.scheduleItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(updated.date).toBeNull();
    expect(
      await prisma.auditLog.findFirst({
        where: { action: "SCHEDULE_UPDATE", entityId: item.id },
      }),
    ).toBeNull();
  });

  it("trims the value, allows clearing, and refuses an unknown row or oversized text", async () => {
    const item = await makeItem("SEMESTER_I");

    await updateScheduleItem(hod, { id: item.id, date: "  10 Sep 2025  ", note: "" });
    let updated = await prisma.scheduleItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(updated.date).toBe("10 Sep 2025");

    await updateScheduleItem(hod, { id: item.id, date: "", note: "" });
    updated = await prisma.scheduleItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(updated.date).toBeNull();

    await expect(
      updateScheduleItem(hod, { id: "missing-id", date: "01 Jan 2025", note: "" }),
    ).rejects.toThrow(/does not exist/);

    await expect(
      updateScheduleItem(hod, { id: item.id, date: "z".repeat(200), note: "" }),
    ).rejects.toThrow(/too_big|120/i);
  });
});

describe("getSchedule groups the two semesters", () => {
  it("returns both terms in order and includes a seeded row", async () => {
    const item = await makeItem("SEMESTER_II");

    const groups = await getSchedule();
    expect(groups.map((g) => g.term)).toEqual(["SEMESTER_I", "SEMESTER_II"]);

    const second = groups.find((g) => g.term === "SEMESTER_II");
    expect(second).toBeDefined();
    expect(second!.rows.some((r) => r.id === item.id)).toBe(true);
  });
});
