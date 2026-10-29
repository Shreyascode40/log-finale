import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import type { Role } from "@/lib/roles";
import { acceptUndertaking, acknowledgeRules } from "../apps/api/src/modules/signoff";
import { createGroup, joinByCode } from "../apps/api/src/modules/groups";

const createdEmails: string[] = [];
const createdGroupIds: string[] = [];

const rid = () => Math.random().toString(36).slice(2, 10);

type TestStudent = { id: string; role: Role; email: string; rollNo: string | null };

async function makeUser(role: Role, label: string, withRoll = true): Promise<TestStudent> {
  const id = rid();
  const email = `${label}.${id}@apcoer.edu.in`;
  const rollNo = withRoll ? `R${id}` : null;
  createdEmails.push(email);
  const user = await prisma.user.create({
    data: {
      name: `${label} ${id}`,
      email,
      rollNo,
      mobile: "9000000000",
      role,
      passwordHash: await hashPassword("Password@123"),
      emailVerifiedAt: new Date(),
      createdVia: role === "STUDENT" ? "SELF_SIGNUP" : "HOD_CREATED",
    },
  });
  return { id: user.id, role, email, rollNo };
}

async function newGroup(creator: TestStudent) {
  const { groupId, code } = await createGroup(creator, { projectTitle: "Sign-off project" });
  createdGroupIds.push(groupId);
  return { groupId, code };
}

async function memberOf(groupId: string, userId: string) {
  return prisma.groupMember.findFirstOrThrow({ where: { groupId, userId } });
}

afterAll(async () => {
  const members = await prisma.groupMember.findMany({
    where: { groupId: { in: createdGroupIds } },
    select: { id: true },
  });
  await prisma.auditLog.deleteMany({
    where: { entityId: { in: [...createdGroupIds, ...members.map((m) => m.id)] } },
  });
  await prisma.group.deleteMany({ where: { id: { in: createdGroupIds } } });
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
});

describe("rules acknowledgement (one student handles the group)", () => {
  it("lets any member sign another member's row and audits the acting user", async () => {
    const creator = await makeUser("STUDENT", "rules-a");
    const { groupId, code } = await newGroup(creator);
    const second = await makeUser("STUDENT", "rules-b");
    await joinByCode(second, { code });

    const secondRow = await memberOf(groupId, second.id);
    const result = await acknowledgeRules(creator, secondRow.id);

    const after = await memberOf(groupId, second.id);
    const creatorRow = await memberOf(groupId, creator.id);
    expect(after.rulesAckAt).not.toBeNull();
    expect(result.acknowledgedAt).toBe(after.rulesAckAt?.toISOString());
    // The acting student did not accidentally sign their own row.
    expect(creatorRow.rulesAckAt).toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: { action: "RULES_ACK", entityId: secondRow.id },
    });
    expect(audit?.userId).toBe(creator.id);
  });

  it("is idempotent — a second click keeps the first timestamp", async () => {
    const creator = await makeUser("STUDENT", "rules-idem");
    const { groupId } = await newGroup(creator);
    const row = await memberOf(groupId, creator.id);

    const first = await acknowledgeRules(creator, row.id);
    const second = await acknowledgeRules(creator, row.id);

    expect(second.acknowledgedAt).toBe(first.acknowledgedAt);
    const after = await memberOf(groupId, creator.id);
    expect(after.rulesAckAt?.toISOString()).toBe(first.acknowledgedAt);
  });

  it("refuses a guide and a student with no group", async () => {
    const guide = await makeUser("GUIDE", "rules-guide", false);
    await expect(acknowledgeRules(guide, "any")).rejects.toThrow(/Only students/);

    const loner = await makeUser("STUDENT", "rules-loner");
    await expect(acknowledgeRules(loner, "any")).rejects.toThrow(/not in a group/);
  });

  it("refuses a member of another group", async () => {
    const owner = await makeUser("STUDENT", "rules-owner");
    const { groupId } = await newGroup(owner);
    const ownerRow = await memberOf(groupId, owner.id);

    const other = await makeUser("STUDENT", "rules-other");
    await newGroup(other);

    await expect(acknowledgeRules(other, ownerRow.id)).rejects.toThrow(/not part of your group/);
  });

  it("is locked after the final PDF is generated", async () => {
    const creator = await makeUser("STUDENT", "rules-locked");
    const { groupId } = await newGroup(creator);
    const row = await memberOf(groupId, creator.id);
    await prisma.group.update({ where: { id: groupId }, data: { status: "PDF_GENERATED" } });
    await expect(acknowledgeRules(creator, row.id)).rejects.toThrow(/locked/i);
  });
});

describe("undertaking acceptance (one student handles the group)", () => {
  it("lets any member accept another member's row", async () => {
    const creator = await makeUser("STUDENT", "undert-a");
    const { groupId, code } = await newGroup(creator);
    const second = await makeUser("STUDENT", "undert-b");
    await joinByCode(second, { code });

    const creatorRow = await memberOf(groupId, creator.id);
    const secondRow = await memberOf(groupId, second.id);
    const result = await acceptUndertaking(second, creatorRow.id);

    const afterCreator = await memberOf(groupId, creator.id);
    const afterSecond = await memberOf(groupId, second.id);
    expect(afterCreator.undertakingAcceptedAt).not.toBeNull();
    expect(result.acceptedAt).toBe(afterCreator.undertakingAcceptedAt?.toISOString());
    expect(afterSecond.undertakingAcceptedAt).toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: { action: "UNDERTAKING_ACCEPT", entityId: creatorRow.id },
    });
    expect(audit?.userId).toBe(second.id);
  });

  it("refuses a guide", async () => {
    const guide = await makeUser("GUIDE", "undert-guide", false);
    await expect(acceptUndertaking(guide, "any")).rejects.toThrow(/Only students/);
  });
});
