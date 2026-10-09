import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import type { Role } from "@/lib/roles";
import { decideTopic, getTopicSheet, saveTopic, scoreTopic } from "@/lib/services/topic";

/**
 * F8 — Topic Finalization. Proves the guide-only scoring, the HOD decision, the
 * Topic 2 lock (master rule 6) and the audit trail against the throwaway db.
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
      projectTitle: "Vitest project",
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

const goodScores = (groupId: string, topicNo: number) => ({
  groupId,
  topicNo,
  significance: 8,
  innovativeness: 7,
  scope: 9,
  feasibility: 6,
  recommendation: "YES" as const,
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.group.deleteMany({ where: { id: { in: createdGroupIds } } });
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
});

describe("topic submission (student)", () => {
  it("lets a group member write and submit a topic and audits it", async () => {
    const guide = await makeUser("GUIDE", "t-guide");
    const student = await makeUser("STUDENT", "t-student");
    const group = await makeGroup(student, guide);

    await saveTopic(student, {
      topicNo: 1,
      title: "Smart campus",
      description: "An IoT energy monitoring system",
      submit: true,
    });

    const topic = await prisma.topicProposal.findUniqueOrThrow({
      where: { groupId_topicNo: { groupId: group.id, topicNo: 1 } },
    });
    expect(topic.status).toBe("SUBMITTED");
    expect(topic.title).toBe("Smart campus");

    const audit = await prisma.auditLog.findFirst({
      where: { action: "TOPIC_SUBMIT", entityId: topic.id },
    });
    expect(audit?.userId).toBe(student.id);
  });

  it("refuses to submit without a title and description", async () => {
    const guide = await makeUser("GUIDE", "t-guide");
    const student = await makeUser("STUDENT", "t-student");
    await makeGroup(student, guide);

    await expect(
      saveTopic(student, { topicNo: 1, title: "", description: "", submit: true }),
    ).rejects.toThrow(/title and description/i);
  });

  it("keeps topics locked until the group is ACTIVE", async () => {
    const guide = await makeUser("GUIDE", "t-guide");
    const student = await makeUser("STUDENT", "t-student");
    await makeGroup(student, guide, "SUBMITTED");

    await expect(
      saveTopic(student, { topicNo: 1, title: "x", description: "y", submit: true }),
    ).rejects.toThrow(/unlock once the HOD approves/);
  });

  it("does not let a topic be edited once submitted", async () => {
    const guide = await makeUser("GUIDE", "t-guide");
    const student = await makeUser("STUDENT", "t-student");
    await makeGroup(student, guide);

    await saveTopic(student, { topicNo: 1, title: "T", description: "D", submit: true });
    await expect(
      saveTopic(student, { topicNo: 1, title: "T2", description: "D2", submit: false }),
    ).rejects.toThrow(/already been submitted/);
  });
});

describe("topic scoring (assigned guide only)", () => {
  it("refuses a student, the HOD and a guide of another group", async () => {
    const guide = await makeUser("GUIDE", "t-guide");
    const otherGuide = await makeUser("GUIDE", "t-guide2");
    const hod = await makeUser("HOD", "t-hod");
    const student = await makeUser("STUDENT", "t-student");
    const group = await makeGroup(student, guide);
    await saveTopic(student, { topicNo: 1, title: "T", description: "D", submit: true });

    await expect(scoreTopic(student, goodScores(group.id, 1))).rejects.toThrow(/Only the project guide/);
    await expect(scoreTopic(hod, goodScores(group.id, 1))).rejects.toThrow(/Only the project guide/);
    await expect(scoreTopic(otherGuide, goodScores(group.id, 1))).rejects.toThrow(
      /guide assigned to this group/,
    );
  });

  it("stores the four scores, the recommendation and the guide signature", async () => {
    const guide = await makeUser("GUIDE", "t-guide");
    const student = await makeUser("STUDENT", "t-student");
    const group = await makeGroup(student, guide);
    await saveTopic(student, { topicNo: 1, title: "T", description: "D", submit: true });

    await scoreTopic(guide, goodScores(group.id, 1));

    const topic = await prisma.topicProposal.findUniqueOrThrow({
      where: { groupId_topicNo: { groupId: group.id, topicNo: 1 } },
    });
    expect(topic.status).toBe("SCORED");
    expect(topic.significance).toBe(8);
    expect(topic.innovativeness).toBe(7);
    expect(topic.scope).toBe(9);
    expect(topic.feasibility).toBe(6);
    expect(topic.guideRecommendation).toBe("YES");

    const sheet = await getTopicSheet(group.id);
    const t1 = sheet.topics.find((t) => t.topicNo === 1)!;
    expect(t1.scoredByName).toBe(guide.name);
    expect(t1.scoredAt).not.toBeNull();
  });

  it("rejects an out-of-range score", async () => {
    const guide = await makeUser("GUIDE", "t-guide");
    const student = await makeUser("STUDENT", "t-student");
    const group = await makeGroup(student, guide);
    await saveTopic(student, { topicNo: 1, title: "T", description: "D", submit: true });

    await expect(
      scoreTopic(guide, { ...goodScores(group.id, 1), significance: 11 }),
    ).rejects.toThrow(/above 10/);
  });
});

describe("topic 2 is enabled only when topic 1 is rejected", () => {
  it("stays locked while topic 1 is pending or approved", async () => {
    const guide = await makeUser("GUIDE", "t-guide");
    const hod = await makeUser("HOD", "t-hod");
    const student = await makeUser("STUDENT", "t-student");
    const group = await makeGroup(student, guide);

    // topic 1 as a draft -> topic 2 refused
    await saveTopic(student, { topicNo: 1, title: "One", description: "D", submit: false });
    await expect(
      saveTopic(student, { topicNo: 2, title: "Two", description: "D", submit: true }),
    ).rejects.toThrow(/only if Topic 1 is rejected/);
    await expect(scoreTopic(guide, goodScores(group.id, 2))).rejects.toThrow(
      /only if Topic 1 is rejected/,
    );

    // approve topic 1 -> topic 2 stays locked
    await saveTopic(student, { topicNo: 1, title: "One", description: "D", submit: true });
    await scoreTopic(guide, goodScores(group.id, 1));
    await decideTopic(hod, { groupId: group.id, topicNo: 1, decision: "APPROVED" });
    await expect(
      saveTopic(student, { topicNo: 2, title: "Two", description: "D", submit: true }),
    ).rejects.toThrow(/only if Topic 1 is rejected/);
  });

  it("unlocks topic 2 after topic 1 is rejected, which needs a written reason", async () => {
    const guide = await makeUser("GUIDE", "t-guide");
    const hod = await makeUser("HOD", "t-hod");
    const student = await makeUser("STUDENT", "t-student");
    const group = await makeGroup(student, guide);

    await saveTopic(student, { topicNo: 1, title: "One", description: "D", submit: true });
    await scoreTopic(guide, goodScores(group.id, 1));

    await expect(
      decideTopic(hod, { groupId: group.id, topicNo: 1, decision: "REJECTED", reason: "" }),
    ).rejects.toThrow(/reason is required/i);

    await decideTopic(hod, {
      groupId: group.id,
      topicNo: 1,
      decision: "REJECTED",
      reason: "Too broad",
    });
    const topic1 = await prisma.topicProposal.findUniqueOrThrow({
      where: { groupId_topicNo: { groupId: group.id, topicNo: 1 } },
    });
    expect(topic1.status).toBe("REJECTED");
    expect(topic1.rejectReason).toBe("Too broad");

    // topic 2 now works end to end
    await saveTopic(student, { topicNo: 2, title: "Two", description: "D", submit: true });
    await scoreTopic(guide, goodScores(group.id, 2));
    await decideTopic(hod, { groupId: group.id, topicNo: 2, decision: "APPROVED" });

    const topic2 = await prisma.topicProposal.findUniqueOrThrow({
      where: { groupId_topicNo: { groupId: group.id, topicNo: 2 } },
    });
    expect(topic2.status).toBe("APPROVED");
  });
});

describe("HOD decision", () => {
  it("is HOD-only and requires the guide to have scored first", async () => {
    const guide = await makeUser("GUIDE", "t-guide");
    const hod = await makeUser("HOD", "t-hod");
    const student = await makeUser("STUDENT", "t-student");
    const group = await makeGroup(student, guide);
    await saveTopic(student, { topicNo: 1, title: "T", description: "D", submit: true });

    await expect(
      decideTopic(guide, { groupId: group.id, topicNo: 1, decision: "APPROVED" }),
    ).rejects.toThrow(/Head of Department/);
    await expect(
      decideTopic(student, { groupId: group.id, topicNo: 1, decision: "APPROVED" }),
    ).rejects.toThrow(/Head of Department/);
    await expect(
      decideTopic(hod, { groupId: group.id, topicNo: 1, decision: "APPROVED" }),
    ).rejects.toThrow(/guide must score/);

    await scoreTopic(guide, goodScores(group.id, 1));
    await decideTopic(hod, { groupId: group.id, topicNo: 1, decision: "APPROVED" });

    const sheet = await getTopicSheet(group.id);
    const t1 = sheet.topics.find((t) => t.topicNo === 1)!;
    expect(t1.status).toBe("APPROVED");
    expect(t1.approvedByName).toBe(hod.name);
    expect(t1.approvedAt).not.toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: { action: "TOPIC_APPROVE" },
      orderBy: { timestamp: "desc" },
    });
    expect(audit?.userId).toBe(hod.id);
  });
});
