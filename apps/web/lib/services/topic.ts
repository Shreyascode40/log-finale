import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { TOPIC2_LOCKED_NOTICE } from "@/lib/constants";
import { topicDecisionSchema, topicScoreSchema, topicTextSchema } from "@/lib/validation/topic";
import { notifyIfReadyForPdf, onTopicDecided, onTopicScored } from "@/lib/services/notifications";
import type { Role } from "@/lib/roles";

/**
 * Topic Finalization (F8). Two topic proposals per group:
 *   students write the title and description -> the assigned guide (reviewer)
 *   scores four criteria 0-10 and records a Yes/No recommendation -> the HOD
 *   approves or rejects.
 *
 * Topic 2 is available only after Topic 1 is rejected (master prompt rule 6).
 * Reads and writes are permission-checked here, never in the UI.
 */

export type TopicActor = { id: string; role: Role };

export type TopicData = {
  topicNo: number;
  title: string;
  description: string;
  significance: number | null;
  innovativeness: number | null;
  scope: number | null;
  feasibility: number | null;
  recommendation: "YES" | "NO" | null;
  status: string;
  rejectReason: string;
  approvedByName: string | null;
  approvedAt: string | null;
  /** Taken from the audit trail — the schema stores only the HOD approval fields. */
  scoredByName: string | null;
  scoredAt: string | null;
};

export type TopicSheet = {
  group: {
    id: string;
    groupNo: string | null;
    projectTitle: string | null;
    status: string;
    guideId: string | null;
  };
  guideName: string | null;
  topics: TopicData[];
};

/** Group statuses in which topics may be filled or scored (master rule 12: ACTIVE). */
const TOPIC_OPEN_STATUSES = ["ACTIVE", "READY_FOR_PDF", "PDF_ALLOWED"];

export function topicsOpen(groupStatus: string): boolean {
  return TOPIC_OPEN_STATUSES.includes(groupStatus);
}

function emptyTopic(topicNo: number): TopicData {
  return {
    topicNo,
    title: "",
    description: "",
    significance: null,
    innovativeness: null,
    scope: null,
    feasibility: null,
    recommendation: null,
    status: "DRAFT",
    rejectReason: "",
    approvedByName: null,
    approvedAt: null,
    scoredByName: null,
    scoredAt: null,
  };
}

/** The full Topic 1 + Topic 2 sheet for a group, ready to render or score. */
export async function getTopicSheet(groupId: string): Promise<TopicSheet> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { guide: { select: { name: true } } },
  });
  if (!group) throw new AppError("GROUP_NOT_FOUND", "Group not found");

  const rows = await prisma.topicProposal.findMany({
    where: { groupId },
    include: { approvedBy: { select: { name: true } } },
  });

  const scoreAudits = rows.length
    ? await prisma.auditLog.findMany({
        where: {
          action: "TOPIC_SCORE",
          entity: "TopicProposal",
          entityId: { in: rows.map((row) => row.id) },
        },
        orderBy: { timestamp: "desc" },
        include: { user: { select: { name: true } } },
      })
    : [];

  const latestScore = new Map<string, { name: string | null; at: string }>();
  for (const audit of scoreAudits) {
    if (audit.entityId && !latestScore.has(audit.entityId)) {
      latestScore.set(audit.entityId, {
        name: audit.user?.name ?? null,
        at: audit.timestamp.toISOString(),
      });
    }
  }

  const byNo = new Map(rows.map((row) => [row.topicNo, row]));
  const topics: TopicData[] = [1, 2].map((topicNo) => {
    const row = byNo.get(topicNo);
    if (!row) return emptyTopic(topicNo);
    const score = latestScore.get(row.id);
    return {
      topicNo: row.topicNo,
      title: row.title ?? "",
      description: row.description ?? "",
      significance: row.significance,
      innovativeness: row.innovativeness,
      scope: row.scope,
      feasibility: row.feasibility,
      recommendation: (row.guideRecommendation as "YES" | "NO" | null) ?? null,
      status: row.status,
      rejectReason: row.rejectReason ?? "",
      approvedByName: row.approvedBy?.name ?? null,
      approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
      scoredByName: score?.name ?? null,
      scoredAt: score?.at ?? null,
    };
  });

  return {
    group: {
      id: group.id,
      groupNo: group.groupNo ?? null,
      projectTitle: group.projectTitle ?? null,
      status: group.status,
      guideId: group.guideId ?? null,
    },
    guideName: group.guide?.name ?? null,
    topics,
  };
}

/** The single group a student belongs to (topics are entered against it). */
export async function getStudentTopicGroupId(userId: string): Promise<string | null> {
  const membership = await prisma.groupMember.findFirst({
    where: { userId },
    select: { groupId: true },
  });
  return membership?.groupId ?? null;
}

/** Assigned groups for the guide's scoring index. */
export async function listGuideTopicGroups(guideId: string) {
  return prisma.group.findMany({
    where: { guideId },
    orderBy: { groupNo: "asc" },
    include: { topics: { orderBy: { topicNo: "asc" } } },
  });
}

/** Every group that has at least one topic, for the HOD approval queue. */
export async function listTopicQueue() {
  return prisma.group.findMany({
    where: { topics: { some: {} } },
    orderBy: { updatedAt: "desc" },
    include: {
      guide: { select: { name: true } },
      topics: { orderBy: { topicNo: "asc" } },
    },
  });
}

async function myStudentGroup(actor: TopicActor) {
  if (actor.role !== "STUDENT") {
    throw new AppError("FORBIDDEN", "Only students of the group can fill in the project topic");
  }
  const membership = await prisma.groupMember.findFirst({
    where: { userId: actor.id },
    include: { group: true },
  });
  if (!membership) throw new AppError("NO_GROUP", "You are not in a group yet");
  return membership.group;
}

async function assertGroupOpen(group: { status: string }) {
  if (group.status === "PDF_GENERATED") {
    throw new AppError("LOCKED", "The log book is locked after the final PDF is generated");
  }
  if (!topicsOpen(group.status)) {
    throw new AppError(
      "NOT_ACTIVE",
      "Topics unlock once the HOD approves the group and assigns a guide",
    );
  }
}

/** Topic 2 exists only once Topic 1 has been rejected (master prompt rule 6). */
async function assertTopic2Unlocked(groupId: string, topicNo: number) {
  if (topicNo !== 2) return;
  const topic1 = await prisma.topicProposal.findUnique({
    where: { groupId_topicNo: { groupId, topicNo: 1 } },
    select: { status: true },
  });
  if (!topic1 || topic1.status !== "REJECTED") {
    throw new AppError("TOPIC2_LOCKED", TOPIC2_LOCKED_NOTICE);
  }
}

export async function saveTopic(actor: TopicActor, input: unknown): Promise<void> {
  const group = await myStudentGroup(actor);
  await assertGroupOpen(group);

  const parsed = topicTextSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { topicNo, title, description, submit } = parsed.data;

  await assertTopic2Unlocked(group.id, topicNo);

  const existing = await prisma.topicProposal.findUnique({
    where: { groupId_topicNo: { groupId: group.id, topicNo } },
  });
  if (existing && !["DRAFT", "REJECTED"].includes(existing.status)) {
    throw new AppError(
      "INVALID_STATE",
      "This topic has already been submitted and can no longer be edited",
    );
  }
  if (submit && (!title || !description)) {
    throw new AppError("INCOMPLETE", "Enter the title and description before submitting");
  }

  const status = submit ? "SUBMITTED" : "DRAFT";
  // A resubmission (or a fresh draft) starts a new review round.
  const data = {
    title: title || null,
    description: description || null,
    status,
    significance: null,
    innovativeness: null,
    scope: null,
    feasibility: null,
    guideRecommendation: null,
    approvedById: null,
    approvedAt: null,
    rejectReason: null,
  };

  const before = existing
    ? { title: existing.title, description: existing.description, status: existing.status }
    : null;

  await prisma.$transaction(async (tx) => {
    const saved = await tx.topicProposal.upsert({
      where: { groupId_topicNo: { groupId: group.id, topicNo } },
      update: data,
      create: { groupId: group.id, topicNo, ...data },
    });
    await logAction(
      {
        userId: actor.id,
        action: submit ? "TOPIC_SUBMIT" : "TOPIC_SAVE",
        entity: "TopicProposal",
        entityId: saved.id,
        before,
        after: { title: data.title, description: data.description, status },
      },
      tx,
    );
  });
}

export async function scoreTopic(actor: TopicActor, input: unknown): Promise<void> {
  const parsed = topicScoreSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { groupId, topicNo, significance, innovativeness, scope, feasibility, recommendation } =
    parsed.data;

  if (actor.role !== "GUIDE") {
    throw new AppError("FORBIDDEN", "Only the project guide can score a topic");
  }
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, status: true, guideId: true },
  });
  if (!group) throw new AppError("GROUP_NOT_FOUND", "Group not found");
  if (group.guideId !== actor.id) {
    throw new AppError("FORBIDDEN", "Only the guide assigned to this group can score the topic");
  }
  await assertGroupOpen(group);
  await assertTopic2Unlocked(groupId, topicNo);

  const existing = await prisma.topicProposal.findUnique({
    where: { groupId_topicNo: { groupId, topicNo } },
  });
  if (!existing) {
    throw new AppError("NOT_FOUND", "The students have not submitted this topic yet");
  }
  if (!["SUBMITTED", "SCORED"].includes(existing.status)) {
    throw new AppError("INVALID_STATE", "The guide can score a submitted topic");
  }

  const data = {
    significance,
    innovativeness,
    scope,
    feasibility,
    guideRecommendation: recommendation,
    status: "SCORED",
  };

  await prisma.$transaction(async (tx) => {
    await tx.topicProposal.update({ where: { id: existing.id }, data });
    await logAction(
      {
        userId: actor.id,
        action: "TOPIC_SCORE",
        entity: "TopicProposal",
        entityId: existing.id,
        before: {
          significance: existing.significance,
          innovativeness: existing.innovativeness,
          scope: existing.scope,
          feasibility: existing.feasibility,
          guideRecommendation: existing.guideRecommendation,
          status: existing.status,
        },
        after: data,
      },
      tx,
    );
  });
  await onTopicScored(groupId, topicNo);
}

export async function decideTopic(actor: TopicActor, input: unknown): Promise<void> {
  if (actor.role !== "HOD") {
    throw new AppError("FORBIDDEN", "Only the Head of Department can approve or reject a topic");
  }
  const parsed = topicDecisionSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { groupId, topicNo, decision, reason } = parsed.data;

  await assertTopic2Unlocked(groupId, topicNo);

  const existing = await prisma.topicProposal.findUnique({
    where: { groupId_topicNo: { groupId, topicNo } },
  });
  if (!existing) throw new AppError("NOT_FOUND", "That topic does not exist");
  if (existing.status !== "SCORED") {
    throw new AppError("INVALID_STATE", "The guide must score the topic before the HOD decides");
  }

  const data =
    decision === "APPROVED"
      ? { status: "APPROVED", approvedById: actor.id, approvedAt: new Date(), rejectReason: null }
      : {
          status: "REJECTED",
          approvedById: actor.id,
          approvedAt: new Date(),
          rejectReason: reason || null,
        };

  await prisma.$transaction(async (tx) => {
    await tx.topicProposal.update({ where: { id: existing.id }, data });
    await logAction(
      {
        userId: actor.id,
        action: decision === "APPROVED" ? "TOPIC_APPROVE" : "TOPIC_REJECT",
        entity: "TopicProposal",
        entityId: existing.id,
        before: { status: existing.status, rejectReason: existing.rejectReason },
        after: { status: data.status, rejectReason: data.rejectReason },
      },
      tx,
    );
  });
  await onTopicDecided(groupId, topicNo, decision === "APPROVED");
  if (decision === "APPROVED") {
    await notifyIfReadyForPdf(groupId);
  }
}
