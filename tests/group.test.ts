import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import type { Role } from "@/lib/roles";
import {
  acceptInvite,
  createGroup,
  inviteMember,
  joinByCode,
  submitGroup,
  type GroupActor,
} from "@/lib/services/group";

const createdEmails: string[] = [];
const createdGroupIds: string[] = [];

const rid = () => Math.random().toString(36).slice(2, 10);

async function makeStudent(label: string): Promise<GroupActor> {
  const id = rid();
  const email = `${label}.${id}@apcoer.edu.in`;
  const rollNo = `R${id}`;
  createdEmails.push(email);
  const user = await prisma.user.create({
    data: {
      name: `${label} ${id}`,
      email,
      rollNo,
      mobile: "9000000000",
      role: "STUDENT",
      passwordHash: await hashPassword("Password@123"),
      emailVerifiedAt: new Date(),
      createdVia: "SELF_SIGNUP",
    },
  });
  return { id: user.id, role: "STUDENT" as Role, email, rollNo };
}

async function makeGuide(): Promise<GroupActor> {
  const id = rid();
  const email = `guide.${id}@apcoer.edu.in`;
  createdEmails.push(email);
  const user = await prisma.user.create({
    data: {
      name: `Guide ${id}`,
      email,
      role: "GUIDE",
      mobile: "9000000000",
      passwordHash: await hashPassword("Password@123"),
      emailVerifiedAt: new Date(),
      createdVia: "HOD_CREATED",
    },
  });
  return { id: user.id, role: "GUIDE" as Role, email, rollNo: null };
}

/** Creates a group and remembers it for cleanup. */
async function newGroup(creator: GroupActor) {
  const { groupId, code } = await createGroup(creator, { projectTitle: "Test project" });
  createdGroupIds.push(groupId);
  return { groupId, code };
}

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { entityId: { in: createdGroupIds } } });
  await prisma.group.deleteMany({ where: { id: { in: createdGroupIds } } });
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
});

describe("group creation", () => {
  it("only students may create a group", async () => {
    const guide = await makeGuide();
    await expect(createGroup(guide, {})).rejects.toThrow(/Only students/);
  });

  it("creates a DRAFT group with the creator as first member and a shareable code", async () => {
    const creator = await makeStudent("creator");
    const { groupId, code } = await newGroup(creator);

    const group = await prisma.group.findUniqueOrThrow({
      where: { id: groupId },
      include: { members: true },
    });
    expect(group.status).toBe("DRAFT");
    expect(group.code).toBe(code);
    expect(group.members).toHaveLength(1);
    expect(group.members[0]?.memberType).toBe("creator");
  });
});

describe("the group never exceeds four members", () => {
  it("rejects the 5th member via code and via invite", async () => {
    const creator = await makeStudent("creator");
    const { groupId, code } = await newGroup(creator);

    const [m1, m2, m3] = await Promise.all([
      makeStudent("m1"),
      makeStudent("m2"),
      makeStudent("m3"),
    ]);
    await joinByCode(m1, { code });
    await joinByCode(m2, { code });
    await joinByCode(m3, { code });

    const fifth = await makeStudent("m5");
    await expect(joinByCode(fifth, { code })).rejects.toThrow(/at most 4 members/);
    await expect(inviteMember(creator, { identifier: fifth.email })).rejects.toThrow(
      /at most 4 members/,
    );

    expect(await prisma.groupMember.count({ where: { groupId } })).toBe(4);
  });
});

describe("a student belongs to at most one group", () => {
  it("cannot create or join a second group", async () => {
    const a = await makeStudent("a");
    const groupA = await newGroup(a);

    const c = await makeStudent("c");
    const groupC = await newGroup(c);

    const b = await makeStudent("b");
    // b is invited to group C while they still have no group
    const { inviteId } = await inviteMember(c, { identifier: b.email });

    // b joins group A
    await joinByCode(b, { code: groupA.code });

    // already a member -> cannot create their own group
    await expect(createGroup(b, {})).rejects.toThrow(/already belong to a group/);

    // already a member -> cannot join another group by code
    await expect(joinByCode(b, { code: groupC.code })).rejects.toThrow(/already belong to a group/);

    // already a member -> the earlier invitation can no longer be accepted
    await expect(acceptInvite(b, { inviteId })).rejects.toThrow(/already belong to a group/);

    // already a member -> inviting them is refused outright
    const d = await makeStudent("d");
    await newGroup(d);
    await expect(inviteMember(d, { identifier: b.email })).rejects.toThrow(
      /already belongs to a group/,
    );
  });
});

describe("invitations", () => {
  it("invites by email, lets only the invited student accept", async () => {
    const creator = await makeStudent("creator");
    const { groupId } = await newGroup(creator);

    const invitee = await makeStudent("invitee");
    const { inviteId } = await inviteMember(creator, { identifier: invitee.email });

    const stranger = await makeStudent("stranger");
    await expect(acceptInvite(stranger, { inviteId })).rejects.toThrow(/not for you/);

    await acceptInvite(invitee, { inviteId });
    expect(await prisma.groupMember.count({ where: { groupId } })).toBe(2);
  });

  it("invites by roll number", async () => {
    const creator = await makeStudent("creator");
    const { groupId } = await newGroup(creator);
    const invitee = await makeStudent("byroll");

    const { inviteId } = await inviteMember(creator, { identifier: invitee.rollNo! });
    await acceptInvite(invitee, { inviteId });
    expect(await prisma.groupMember.count({ where: { groupId } })).toBe(2);
  });

  it("refuses a bad join code", async () => {
    const s = await makeStudent("solo");
    await expect(joinByCode(s, { code: "ZZZZZZ" })).rejects.toThrow(/No group matches/);
  });
});

describe("submission", () => {
  it("only the creator can submit, and only once", async () => {
    const creator = await makeStudent("creator");
    const { groupId, code } = await newGroup(creator);
    const member = await makeStudent("member");
    await joinByCode(member, { code });

    await expect(submitGroup(member, { groupId })).rejects.toThrow(/Only the group creator/);

    await submitGroup(creator, { groupId });
    const submitted = await prisma.group.findUniqueOrThrow({ where: { id: groupId } });
    expect(submitted.status).toBe("SUBMITTED");

    await expect(submitGroup(creator, { groupId })).rejects.toThrow(/already been submitted/);

    // once submitted, invites and joins are closed
    await expect(inviteMember(creator, { identifier: creator.email })).rejects.toThrow(/draft/);
    const late = await makeStudent("late");
    await expect(joinByCode(late, { code })).rejects.toThrow(/no longer open/);
  });
});
