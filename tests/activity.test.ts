import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import type { Role } from "@/lib/roles";
import { listRecentActivity } from "../apps/api/src/modules/activity";

/**
 * Recent activity feed — proves the role scoping: the HOD sees everything, a
 * student sees events about their own group (including by teammates), and a
 * guide sees the events of the groups assigned to them.
 */

type Actor = { id: string; role: Role };

const createdEmails: string[] = [];
const createdGroupIds: string[] = [];
const createdAuditIds: string[] = [];

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

async function makeGroup(creator: Actor, partner: Actor, guide: Actor | null) {
  const group = await prisma.group.create({
    data: {
      creatorId: creator.id,
      guideId: guide?.id ?? null,
      status: "ACTIVE",
      members: {
        create: [
          { userId: creator.id, name: "Creator", memberType: "creator" },
          { userId: partner.id, name: "Partner", memberType: "member" },
        ],
      },
    },
    include: { members: { orderBy: { memberType: "desc" } } },
  });
  createdGroupIds.push(group.id);
  const partnerMember = group.members.find((m) => m.userId === partner.id)!;
  return { group, partnerMember };
}

async function makeAudit(user: Actor, action: string, entity: string, entityId: string) {
  const row = await prisma.auditLog.create({
    data: { userId: user.id, action, entity, entityId },
  });
  createdAuditIds.push(row.id);
  return row;
}

let hod: Actor;
let guideA: Actor;
let a1: Actor;
let a2: Actor;
let b1: Actor;
let b2: Actor;

let aGroupRow: { id: string };
let aMemberRow: { id: string };
let bGroupRow: { id: string };
let bMemberRow: { id: string };

beforeAll(async () => {
  hod = await makeUser("HOD", "act-hod");
  guideA = await makeUser("GUIDE", "act-guide");
  a1 = await makeUser("STUDENT", "act-a1");
  a2 = await makeUser("STUDENT", "act-a2");
  b1 = await makeUser("STUDENT", "act-b1");
  b2 = await makeUser("STUDENT", "act-b2");

  const groupA = await makeGroup(a1, a2, guideA);
  const groupB = await makeGroup(b1, b2, null);

  aGroupRow = await makeAudit(a1, "GROUP_CREATE", "Group", groupA.group.id);
  aMemberRow = await makeAudit(a2, "RULES_ACK", "GroupMember", groupA.partnerMember.id);
  bGroupRow = await makeAudit(b1, "GROUP_CREATE", "Group", groupB.group.id);
  bMemberRow = await makeAudit(b2, "RULES_ACK", "GroupMember", groupB.partnerMember.id);
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { id: { in: createdAuditIds } } });
  await prisma.group.deleteMany({ where: { id: { in: createdGroupIds } } });
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
});

describe("listRecentActivity role scoping", () => {
  it("shows the HOD every group's events", async () => {
    const ids = new Set((await listRecentActivity(hod, 50)).map((i) => i.id));
    expect(ids.has(aGroupRow.id)).toBe(true);
    expect(ids.has(aMemberRow.id)).toBe(true);
    expect(ids.has(bGroupRow.id)).toBe(true);
    expect(ids.has(bMemberRow.id)).toBe(true);
  });

  it("shows a student their own group's events, including a teammate's", async () => {
    const ids = new Set((await listRecentActivity(a1, 50)).map((i) => i.id));
    expect(ids.has(aGroupRow.id)).toBe(true);
    expect(ids.has(aMemberRow.id)).toBe(true);
    expect(ids.has(bGroupRow.id)).toBe(false);
    expect(ids.has(bMemberRow.id)).toBe(false);
  });

  it("shows the assigned guide that group's events and nothing from other groups", async () => {
    const feed = await listRecentActivity(guideA, 50);
    const ids = new Set(feed.map((i) => i.id));
    expect(ids.has(aGroupRow.id)).toBe(true);
    expect(ids.has(aMemberRow.id)).toBe(true);
    expect(ids.has(bGroupRow.id)).toBe(false);
    expect(ids.has(bMemberRow.id)).toBe(false);
  });

  it("labels actions in plain English", async () => {
    const feed = await listRecentActivity(b1, 50);
    const created = feed.find((i) => i.id === bGroupRow.id);
    expect(created?.summary).toBe("created a group");
    expect(created?.actorName.length).toBeGreaterThan(0);
  });
});
