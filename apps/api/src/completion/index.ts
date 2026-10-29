import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { EXAMINER_QUESTIONS } from "../constants.js";
import type { SectionStatus } from "./sections.js";

/**
 * Completion registry (F15). Aggregates every section into an overall percent
 * and answers "ready for PDF" (every mandatory section complete). The PDF
 * route (F16) gates on this plus the HOD permission.
 *
 * The batch implementation is deliberate: the HOD and guide dashboards need
 * completion for many groups. Querying each section per group caused hundreds
 * of round-trips and timed out behind the Supabase transaction pooler. This
 * version loads every group's related rows in one pass and computes the same
 * statuses in memory.
 */

export type { SectionStatus };

export type GroupCompletion = {
  sections: SectionStatus[];
  /** Mean of section percents, 0-100. */
  percent: number;
  complete: boolean;
  /** Labels of incomplete sections, for the 403 message and dashboards. */
  missing: string[];
};

type GroupWithMembers = Prisma.GroupGetPayload<{
  include: { guide: { select: { id: true; name: true } }; members: true };
}>;

type BatchData = {
  activityTotal: number;
  activityDone: Map<string, number>;
  topics: Map<string, Map<string, number>>;
  content: Map<string, { richText: string | null; fileUrl: string | null }>;
  reviewTemplateIds: Set<string>;
  reviews: Map<string, { status: string; templateId: string }[]>;
  marks: Map<string, { kind: string; status: string; memberId: string | null }[]>;
  examiners: Map<string, { term: string; answers: string }>;
  checklists: Map<string, { term: string; items: string }>;
  competitions: Map<string, number>;
  papers: Map<string, number>;
  meetings: Map<
    string,
    { studentSignedAt: Date | null; guideSignedAt: Date | null }[]
  >;
  feedback: Map<string, { company: string | null; ratings: string; sealUrl: string | null }>;
};

const MEMBER_FIELDS = [
  "name",
  "teResult",
  "rollNo",
  "mobile",
  "examSeatNo",
  "email",
  "contribution",
  "photoUrl",
] as const;

const full = (key: string, label: string, href: string): SectionStatus => ({
  key,
  label,
  href,
  complete: true,
  percent: 100,
});

const empty = (key: string, label: string, href: string, percent = 0): SectionStatus => ({
  key,
  label,
  href,
  complete: false,
  percent,
});

function addToMap<T>(map: Map<string, T[]>, key: string, value: T): void {
  const current = map.get(key);
  if (current) current.push(value);
  else map.set(key, [value]);
}

function countMap(rows: { groupId: string; _count: { _all: number } }[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) map.set(row.groupId, row._count._all);
  return map;
}

function completionForGroup(group: GroupWithMembers, data: BatchData): GroupCompletion {
  const sections: SectionStatus[] = [];
  const memberCount = group.members.length;
  const memberIds = new Set(group.members.map((member) => member.id));

  // 1. Cover
  const coverFields = [
    group.department,
    group.academicYear,
    group.projectTitle,
    group.area,
    group.groupNo,
  ];
  const coverFilled = coverFields.filter(
    (field) => field && field.trim().length > 0,
  ).length;
  const coverGuided = group.guide ? 1 : 0;
  const coverPercent = Math.round(((coverFilled + coverGuided) / 6) * 100);
  sections.push(
    coverFilled === 5 && coverGuided === 1
      ? full("cover", "Cover", "/student/cover")
      : empty("cover", "Cover", "/student/cover", coverPercent),
  );

  // 2. Group information
  if (memberCount === 0) {
    sections.push(empty("members", "Group information", "/student/members"));
  } else {
    const filled = group.members.filter((member) =>
      MEMBER_FIELDS.every((field) => {
        const value = member[field];
        return typeof value === "string" && value.trim().length > 0;
      }),
    ).length;
    const percent = Math.round((filled / memberCount) * 100);
    sections.push(
      filled === memberCount
        ? full("members", "Group information", "/student/members")
        : empty("members", "Group information", "/student/members", percent),
    );
  }

  // 3. Rules acknowledgement
  if (memberCount === 0) {
    sections.push(empty("rules", "Rules acknowledgement", "/student/rules"));
  } else {
    const acknowledged = group.members.filter(
      (member) => member.rulesAckAt,
    ).length;
    const percent = Math.round((acknowledged / memberCount) * 100);
    sections.push(
      acknowledged === memberCount
        ? full("rules", "Rules acknowledgement", "/student/rules")
        : empty("rules", "Rules acknowledgement", "/student/rules", percent),
    );
  }

  // 4. Undertaking
  if (memberCount === 0) {
    sections.push(empty("undertaking", "Undertaking", "/student/undertaking"));
  } else {
    const accepted = group.members.filter(
      (member) => member.undertakingAcceptedAt,
    ).length;
    const percent = Math.round((accepted / memberCount) * 100);
    sections.push(
      accepted === memberCount
        ? full("undertaking", "Undertaking", "/student/undertaking")
        : empty("undertaking", "Undertaking", "/student/undertaking", percent),
    );
  }

  // 5. Topic finalization
  const topicCounts = data.topics.get(group.id);
  sections.push(
    (topicCounts?.get("APPROVED") ?? 0) > 0
      ? full("topics", "Topic finalization", "/student/topics")
      : empty("topics", "Topic finalization", "/student/topics"),
  );

  // 6. Activity charts
  if (data.activityTotal === 0) {
    sections.push(empty("activity", "Activity charts", "/student/activity/june"));
  } else {
    const done = data.activityDone.get(group.id) ?? 0;
    const percent = Math.min(
      100,
      Math.round((done / data.activityTotal) * 100),
    );
    sections.push(
      done >= data.activityTotal
        ? full("activity", "Activity charts", "/student/activity/june")
        : empty("activity", "Activity charts", "/student/activity/june", percent),
    );
  }

  // 7. RTM and project cost estimation
  for (const [type, label, href] of [
    ["RTM", "Requirement Traceability Matrix", "/student/rtm"],
    ["COST", "Project Cost Estimation", "/student/cost"],
  ] as const) {
    const row = data.content.get(`${group.id}:${type}`);
    const present = Boolean(row?.richText?.trim() || row?.fileUrl);
    const key = type.toLowerCase();
    sections.push(
      present ? full(key, label, href) : empty(key, label, href),
    );
  }

  // 8. Reviews
  if (data.reviewTemplateIds.size === 0) {
    sections.push(empty("reviews", "Reviews", "/student/reviews"));
  } else {
    const approved = (data.reviews.get(group.id) ?? []).filter(
      (review) =>
        review.status === "APPROVED" &&
        data.reviewTemplateIds.has(review.templateId),
    ).length;
    const percent = Math.min(
      100,
      Math.round((approved / data.reviewTemplateIds.size) * 100),
    );
    sections.push(
      approved >= data.reviewTemplateIds.size
        ? full("reviews", "Reviews", "/student/reviews")
        : empty("reviews", "Reviews", "/student/reviews", percent),
    );
  }

  // 9. Mock and final evaluation (one approved row per member)
  const evalSection = (
    kind: "MOCK_T1" | "FINAL_T2",
    key: string,
    label: string,
    href: string,
  ) => {
    if (memberCount === 0) return empty(key, label, href);
    const approvedMembers = new Set(
      (data.marks.get(group.id) ?? [])
        .filter((row) => row.kind === kind && row.status === "APPROVED")
        .map((row) => row.memberId)
        .filter((id): id is string => Boolean(id) && memberIds.has(id as string)),
    ).size;
    const percent = Math.min(
      100,
      Math.round((approvedMembers / memberCount) * 100),
    );
    return approvedMembers >= memberCount
      ? full(key, label, href)
      : empty(key, label, href, percent);
  };
  sections.push(
    evalSection("MOCK_T1", "mock", "Mock Evaluation (50)", "/student/mock"),
  );
  sections.push(
    evalSection("FINAL_T2", "final", "Final Evaluation (100)", "/student/final"),
  );

  // 10. Examiner feedback
  const examinerSection = (
    term: "TERM_I" | "TERM_II",
    key: string,
    label: string,
  ) => {
    const href = `/student/examiner/${term}`;
    const row = data.examiners.get(`${group.id}:${term}`);
    if (row) {
      try {
        const answers = JSON.parse(row.answers) as unknown[];
        if (
          Array.isArray(answers) &&
          answers.length === EXAMINER_QUESTIONS.length &&
          answers.every(
            (answer) =>
              answer === "Excellent" ||
              answer === "Good" ||
              answer === "Satisfactory",
          )
        ) {
          return full(key, label, href);
        }
      } catch {
        // corrupt JSON counts as incomplete
      }
    }
    return empty(key, label, href);
  };
  sections.push(examinerSection("TERM_I", "examiner1", "Examiner Feedback Term-I"));
  sections.push(examinerSection("TERM_II", "examiner2", "Examiner Feedback Term-II"));

  // 11. Submission checklists
  const checklistSection = (
    term: "TERM_I" | "TERM_II",
    key: string,
    label: string,
  ) => {
    const href = "/student/checklists";
    const row = data.checklists.get(`${group.id}:${term}`);
    if (row) {
      try {
        const items = JSON.parse(row.items) as { checked?: boolean }[];
        if (
          Array.isArray(items) &&
          items.length > 0 &&
          items.every((item) => item.checked)
        ) {
          return full(key, label, href);
        }
        if (Array.isArray(items) && items.length > 0) {
          const done = items.filter((item) => item.checked).length;
          return empty(key, label, href, Math.round((done / items.length) * 100));
        }
      } catch {
        // corrupt JSON counts as incomplete
      }
    }
    return empty(key, label, href);
  };
  sections.push(checklistSection("TERM_I", "checklist1", "Checklist Term-I"));
  sections.push(checklistSection("TERM_II", "checklist2", "Checklist Term-II"));

  // 12. Competition and paper
  sections.push(
    (data.competitions.get(group.id) ?? 0) > 0
      ? full("competitions", "Competition", "/student/competitions")
      : empty("competitions", "Competition", "/student/competitions"),
  );
  sections.push(
    (data.papers.get(group.id) ?? 0) > 0
      ? full("papers", "Paper publication", "/student/papers")
      : empty("papers", "Paper publication", "/student/papers"),
  );

  // 13. Sponsored project (only for sponsored groups)
  if (group.isSponsored) {
    const meetings = data.meetings.get(group.id) ?? [];
    const feedback = data.feedback.get(group.id);
    let feedbackDone = false;
    if (feedback) {
      try {
        const ratings = JSON.parse(feedback.ratings) as Record<string, unknown>;
        feedbackDone =
          Boolean(feedback.company) &&
          ["p1", "p2", "p3", "p4", "p5", "p6", "p7"].every(
            (key) =>
              ratings[key] === "HIGH" ||
              ratings[key] === "MEDIUM" ||
              ratings[key] === "LOW",
          ) &&
          Boolean(feedback.sealUrl);
      } catch {
        feedbackDone = false;
      }
    }
    const signedMeetings = meetings.filter((meeting) => meeting.guideSignedAt).length;
    const meetingsDone = meetings.length > 0 && signedMeetings >= meetings.length;
    const percent =
      meetings.length === 0
        ? feedbackDone
          ? 50
          : 0
        : Math.round(
            (signedMeetings / meetings.length) * 50 + (feedbackDone ? 50 : 0),
          );
    sections.push(
      feedbackDone && meetingsDone
        ? full("sponsored", "Sponsored project", "/student/sponsored")
        : empty("sponsored", "Sponsored project", "/student/sponsored", percent),
    );
  }

  const percent =
    sections.length === 0
      ? 0
      : Math.round(
          sections.reduce((sum, section) => sum + section.percent, 0) /
            sections.length,
        );
  const missing = sections
    .filter((section) => !section.complete)
    .map((section) => section.label);
  return { sections, percent, complete: missing.length === 0, missing };
}

type CompletionBatch = {
  groups: GroupWithMembers[];
  data: BatchData;
};

/**
 * Loads every group's completion in a fixed number of queries, regardless of
 * how many groups are requested. This is the path used by dashboards and the
 * PDF gate.
 */
async function loadCompletionBatch(
  ids: string[],
  preloadedGroups?: GroupWithMembers[],
): Promise<CompletionBatch> {
  const [
    groups,
    activityTotal,
    activityDoneRows,
    topicRows,
    contentRows,
    reviewTemplates,
    reviewRows,
    markRows,
    examinerRows,
    checklistRows,
    competitionRows,
    paperRows,
    meetingRows,
    feedbackRows,
  ] = await Promise.all([
    preloadedGroups
      ? Promise.resolve(preloadedGroups)
      : prisma.group.findMany({
          where: { id: { in: ids } },
          include: {
            guide: { select: { id: true, name: true } },
            members: true,
          },
        }),
    prisma.activityTemplate.count(),
    prisma.activityEntry.groupBy({
      by: ["groupId"],
      where: {
        groupId: { in: ids },
        status: "GUIDE_VERIFIED",
        statusText: "COMPLETE",
      },
      _count: { _all: true },
    }),
    prisma.topicProposal.groupBy({
      by: ["groupId", "status"],
      where: { groupId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.contentPage.findMany({
      where: {
        groupId: { in: ids },
        type: { in: ["RTM", "COST"] },
        sortOrder: 0,
      },
      select: { groupId: true, type: true, richText: true, fileUrl: true },
    }),
    prisma.reviewTemplate.findMany({ select: { id: true } }),
    prisma.reviewForm.findMany({
      where: { groupId: { in: ids } },
      select: { groupId: true, status: true, templateId: true },
    }),
    prisma.marksSheet.findMany({
      where: { groupId: { in: ids } },
      select: { groupId: true, kind: true, status: true, memberId: true },
    }),
    prisma.examinerFeedback.findMany({
      where: { groupId: { in: ids } },
      select: { groupId: true, term: true, answers: true },
    }),
    prisma.checklist.findMany({
      where: { groupId: { in: ids } },
      select: { groupId: true, term: true, items: true },
    }),
    prisma.competition.groupBy({
      by: ["groupId"],
      where: { groupId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.paperPublication.groupBy({
      by: ["groupId"],
      where: { groupId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.sponsoredMeeting.findMany({
      where: { groupId: { in: ids } },
      select: {
        groupId: true,
        studentSignedAt: true,
        guideSignedAt: true,
      },
    }),
    prisma.sponsorFeedback.findMany({
      where: { groupId: { in: ids } },
      select: { groupId: true, company: true, ratings: true, sealUrl: true },
    }),
  ]);

  const topics = new Map<string, Map<string, number>>();
  for (const row of topicRows) {
    const counts = topics.get(row.groupId) ?? new Map<string, number>();
    counts.set(row.status, row._count._all);
    topics.set(row.groupId, counts);
  }

  const content = new Map<
    string,
    { richText: string | null; fileUrl: string | null }
  >();
  for (const row of contentRows) {
    content.set(`${row.groupId}:${row.type}`, {
      richText: row.richText,
      fileUrl: row.fileUrl,
    });
  }

  const reviews = new Map<string, { status: string; templateId: string }[]>();
  for (const row of reviewRows) {
    addToMap(reviews, row.groupId, {
      status: row.status,
      templateId: row.templateId,
    });
  }

  const marks = new Map<
    string,
    { kind: string; status: string; memberId: string | null }[]
  >();
  for (const row of markRows) {
    addToMap(marks, row.groupId, {
      kind: row.kind,
      status: row.status,
      memberId: row.memberId,
    });
  }

  const examiners = new Map<string, { term: string; answers: string }>();
  for (const row of examinerRows) {
    examiners.set(`${row.groupId}:${row.term}`, {
      term: row.term,
      answers: row.answers,
    });
  }

  const checklists = new Map<string, { term: string; items: string }>();
  for (const row of checklistRows) {
    checklists.set(`${row.groupId}:${row.term}`, {
      term: row.term,
      items: row.items,
    });
  }

  const meetings = new Map<
    string,
    { studentSignedAt: Date | null; guideSignedAt: Date | null }[]
  >();
  for (const row of meetingRows) {
    addToMap(meetings, row.groupId, {
      studentSignedAt: row.studentSignedAt,
      guideSignedAt: row.guideSignedAt,
    });
  }

  const feedback = new Map<
    string,
    { company: string | null; ratings: string; sealUrl: string | null }
  >();
  for (const row of feedbackRows) {
    feedback.set(row.groupId, {
      company: row.company,
      ratings: row.ratings,
      sealUrl: row.sealUrl,
    });
  }

  return {
    groups,
    data: {
      activityTotal,
      activityDone: countMap(activityDoneRows),
      topics,
      content,
      reviewTemplateIds: new Set(reviewTemplates.map((template) => template.id)),
      reviews,
      marks,
      examiners,
      checklists,
      competitions: countMap(competitionRows),
      papers: countMap(paperRows),
      meetings,
      feedback,
    },
  };
}

function completionsForBatch(
  batch: CompletionBatch,
): Map<string, GroupCompletion> {
  return new Map(
    batch.groups.map((group) => [
      group.id,
      completionForGroup(group, batch.data),
    ]),
  );
}

export async function getGroupCompletions(
  groupIds: string[],
): Promise<Map<string, GroupCompletion>> {
  const ids = Array.from(new Set(groupIds)).filter(Boolean);
  if (ids.length === 0) return new Map();
  return completionsForBatch(await loadCompletionBatch(ids));
}

export async function getGroupCompletion(
  groupId: string,
): Promise<GroupCompletion> {
  const completion = (await getGroupCompletions([groupId])).get(groupId);
  if (!completion) throw new Error("Group not found");
  return completion;
}

export type GuideGroupPending = {
  groupId: string;
  groupNo: string | null;
  projectTitle: string | null;
  status: string;
  percent: number;
  /** Rows the students confirmed that still need the guide's verify. */
  unverifiedEntries: number;
  /** Topics submitted but not yet scored. */
  topicsToScore: number;
  /** Review drafts to fill and submitted reviews to approve. */
  draftReviews: number;
  submittedReviews: number;
  /** Mock/final rows still draft or submitted. */
  openMockRows: number;
  openFinalRows: number;
  /** Meeting rows signed by students but not countersigned. */
  unsignedMeetings: number;
};

/** Assigned groups with everything awaiting this guide. */
export async function getGuideOverview(
  guideId: string,
): Promise<GuideGroupPending[]> {
  const groups = await prisma.group.findMany({
    where: { guideId },
    orderBy: { groupNo: "asc" },
    include: {
      guide: { select: { id: true, name: true } },
      members: true,
    },
  });
  const ids = groups.map((group) => group.id);
  if (ids.length === 0) return [];

  const [{ data }, entries] = await Promise.all([
    loadCompletionBatch(ids, groups),
    prisma.activityEntry.groupBy({
      by: ["groupId"],
      where: { groupId: { in: ids }, status: "STUDENT_CONFIRMED" },
      _count: { _all: true },
    }),
  ]);

  const completions = completionsForBatch({ groups, data });
  const entryCounts = countMap(entries);

  return groups.map((group) => {
    const completion = completions.get(group.id);
    const formsForGroup = data.reviews.get(group.id) ?? [];
    const markRows = data.marks.get(group.id) ?? [];
    const openRows = (kind: "MOCK_T1" | "FINAL_T2") =>
      markRows.filter((row) => row.kind === kind && row.status !== "APPROVED")
        .length;
    const unsignedMeetings = (data.meetings.get(group.id) ?? []).filter(
      (meeting) => meeting.studentSignedAt && !meeting.guideSignedAt,
    ).length;
    return {
      groupId: group.id,
      groupNo: group.groupNo ?? null,
      projectTitle: group.projectTitle ?? null,
      status: group.status,
      percent: completion?.percent ?? 0,
      unverifiedEntries: entryCounts.get(group.id) ?? 0,
      topicsToScore: data.topics.get(group.id)?.get("SUBMITTED") ?? 0,
      draftReviews: formsForGroup.filter((form) => form.status === "DRAFT")
        .length,
      submittedReviews: formsForGroup.filter(
        (form) => form.status === "SUBMITTED",
      ).length,
      openMockRows: openRows("MOCK_T1"),
      openFinalRows: openRows("FINAL_T2"),
      unsignedMeetings,
    };
  });
}

export type HodGroupRow = {
  groupId: string;
  groupNo: string | null;
  projectTitle: string | null;
  status: string;
  guideName: string | null;
  isSponsored: boolean;
  pdfPermission: boolean;
  percent: number;
  ready: boolean;
  missing: string[];
  submittedTopics: number;
  submittedReviews: number;
  submittedSheets: number;
};

/** Every group with completion, readiness and approval queues for the HOD. */
export async function getHodOverview(): Promise<HodGroupRow[]> {
  const groups = await prisma.group.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      guide: { select: { id: true, name: true } },
      members: true,
    },
  });
  const ids = groups.map((group) => group.id);
  if (ids.length === 0) return [];

  const { data } = await loadCompletionBatch(ids, groups);
  const completions = completionsForBatch({ groups, data });

  return groups.map((group) => {
    const completion = completions.get(group.id);
    return {
      groupId: group.id,
      groupNo: group.groupNo ?? null,
      projectTitle: group.projectTitle ?? null,
      status: group.status,
      guideName: group.guide?.name ?? null,
      isSponsored: group.isSponsored,
      pdfPermission: group.pdfPermission,
      percent: completion?.percent ?? 0,
      ready: completion?.complete ?? false,
      missing: completion?.missing ?? [],
      submittedTopics: data.topics.get(group.id)?.get("SCORED") ?? 0,
      submittedReviews: (data.reviews.get(group.id) ?? []).filter(
        (form) => form.status === "SUBMITTED",
      ).length,
      submittedSheets: (data.marks.get(group.id) ?? []).filter(
        (row) => row.status === "SUBMITTED",
      ).length,
    };
  });
}
