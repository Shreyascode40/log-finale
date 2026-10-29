import { prisma } from "../db.js";
import { EXAMINER_QUESTIONS } from "../constants.js";

/**
 * Completion engine (F15). Each section exposes its status; the registry in
 * `index.ts` aggregates them into an overall percent. "Complete" follows
 * SPEC.md A5 exactly.
 */

export type SectionStatus = {
  key: string;
  label: string;
  /** Student route for the stepper. */
  href: string;
  complete: boolean;
  /** 0–100. */
  percent: number;
};

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

async function groupOrThrow(groupId: string) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      guide: { select: { id: true } },
      members: true,
    },
  });
  if (!group) throw new Error("Group not found");
  return group;
}

export async function getCoverStatus(groupId: string): Promise<SectionStatus[]> {
  const group = await groupOrThrow(groupId);
  const fields = [group.department, group.academicYear, group.projectTitle, group.area, group.groupNo];
  const filled = fields.filter((field) => field && field.trim().length > 0).length;
  const guided = group.guide ? 1 : 0;
  const percent = Math.round(((filled + guided) / 6) * 100);
  const key = "cover";
  const label = "Cover";
  if (filled === 5 && guided === 1) return [full(key, label, "/student/cover")];
  return [{ key, label, href: "/student/cover", complete: false, percent }];
}

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

export async function getMembersStatus(groupId: string): Promise<SectionStatus[]> {
  const group = await groupOrThrow(groupId);
  if (group.members.length === 0) return [empty("members", "Group information", "/student/members")];
  const filled = group.members.filter((member) =>
    MEMBER_FIELDS.every((field) => {
      const value = member[field];
      return typeof value === "string" && value.trim().length > 0;
    }),
  ).length;
  const percent = Math.round((filled / group.members.length) * 100);
  if (filled === group.members.length) return [full("members", "Group information", "/student/members")];
  return [{ key: "members", label: "Group information", href: "/student/members", complete: false, percent }];
}

export async function getRulesStatus(groupId: string): Promise<SectionStatus[]> {
  const group = await groupOrThrow(groupId);
  if (group.members.length === 0) return [empty("rules", "Rules acknowledgement", "/student/rules")];
  const acked = group.members.filter((member) => member.rulesAckAt).length;
  const percent = Math.round((acked / group.members.length) * 100);
  if (acked === group.members.length) return [full("rules", "Rules acknowledgement", "/student/rules")];
  return [{ key: "rules", label: "Rules acknowledgement", href: "/student/rules", complete: false, percent }];
}

export async function getUndertakingStatus(groupId: string): Promise<SectionStatus[]> {
  const group = await groupOrThrow(groupId);
  if (group.members.length === 0) return [empty("undertaking", "Undertaking", "/student/undertaking")];
  const accepted = group.members.filter((member) => member.undertakingAcceptedAt).length;
  const percent = Math.round((accepted / group.members.length) * 100);
  if (accepted === group.members.length) return [full("undertaking", "Undertaking", "/student/undertaking")];
  return [{ key: "undertaking", label: "Undertaking", href: "/student/undertaking", complete: false, percent }];
}

export async function getTopicsStatus(groupId: string): Promise<SectionStatus[]> {
  const approved = await prisma.topicProposal.count({ where: { groupId, status: "APPROVED" } });
  if (approved > 0) return [full("topics", "Topic finalization", "/student/topics")];
  return [empty("topics", "Topic finalization", "/student/topics")];
}

export async function getActivityStatus(groupId: string): Promise<SectionStatus[]> {
  const key = "activity";
  const label = "Activity charts";
  const href = "/student/activity/june";
  const total = await prisma.activityTemplate.count();
  if (total === 0) return [empty(key, label, href)];
  const done = await prisma.activityEntry.count({
    where: { groupId, status: "GUIDE_VERIFIED", statusText: "COMPLETE" },
  });
  const percent = Math.min(100, Math.round((done / total) * 100));
  if (done >= total) return [full(key, label, href)];
  return [{ key, label, href, complete: false, percent }];
}

export async function getContentStatus(
  groupId: string,
  type: "RTM" | "COST",
  label: string,
  href: string,
): Promise<SectionStatus[]> {
  const row = await prisma.contentPage.findUnique({
    where: { groupId_type_sortOrder: { groupId, type, sortOrder: 0 } },
  });
  const present =
    (row?.richText && row.richText.trim().length > 0 ? true : false) || Boolean(row?.fileUrl);
  if (present) return [full(type.toLowerCase(), label, href)];
  return [empty(type.toLowerCase(), label, href)];
}

export async function getReviewsStatus(groupId: string): Promise<SectionStatus[]> {
  const key = "reviews";
  const label = "Reviews";
  const href = "/student/reviews";
  const templates = await prisma.reviewTemplate.findMany({ select: { id: true } });
  if (templates.length === 0) return [empty(key, label, href)];
  const approved = await prisma.reviewForm.count({
    where: { groupId, status: "APPROVED", templateId: { in: templates.map((t) => t.id) } },
  });
  const percent = Math.min(100, Math.round((approved / templates.length) * 100));
  if (approved >= templates.length) return [full(key, label, href)];
  return [{ key, label, href, complete: false, percent }];
}

export async function getEvalStatus(
  groupId: string,
  kind: "MOCK_T1" | "FINAL_T2",
  key: string,
  label: string,
  href: string,
): Promise<SectionStatus[]> {
  const group = await groupOrThrow(groupId);
  if (group.members.length === 0) return [empty(key, label, href)];
  // One approved row per member is required.
  const memberIds = new Set(group.members.map((m) => m.id));
  const approvedRows = await prisma.marksSheet.findMany({
    where: { groupId, kind, status: "APPROVED" },
    select: { memberId: true },
  });
  const approvedMembers = new Set(
    approvedRows.map((row) => row.memberId).filter((id) => memberIds.has(id)),
  ).size;
  const percent = Math.min(100, Math.round((approvedMembers / group.members.length) * 100));
  if (approvedMembers >= group.members.length) return [full(key, label, href)];
  return [{ key, label, href, complete: false, percent }];
}

export async function getExaminerStatus(
  groupId: string,
  term: "TERM_I" | "TERM_II",
  key: string,
  label: string,
): Promise<SectionStatus[]> {
  const href = `/student/examiner/${term}`;
  const row = await prisma.examinerFeedback.findUnique({
    where: { groupId_term: { groupId, term } },
  });
  if (row) {
    try {
      const answers = JSON.parse(row.answers) as unknown[];
      if (
        Array.isArray(answers) &&
        answers.length === EXAMINER_QUESTIONS.length &&
        answers.every((a) => a === "Excellent" || a === "Good" || a === "Satisfactory")
      ) {
        return [full(key, label, href)];
      }
    } catch {
      // corrupt JSON counts as incomplete
    }
  }
  return [empty(key, label, href)];
}

export async function getChecklistStatus(
  groupId: string,
  term: "TERM_I" | "TERM_II",
  key: string,
  label: string,
): Promise<SectionStatus[]> {
  const href = "/student/checklists";
  const row = await prisma.checklist.findUnique({ where: { groupId_term: { groupId, term } } });
  if (row) {
    try {
      const items = JSON.parse(row.items) as { checked?: boolean }[];
      if (Array.isArray(items) && items.length > 0 && items.every((item) => item.checked)) {
        return [full(key, label, href)];
      }
      if (Array.isArray(items) && items.length > 0) {
        const done = items.filter((item) => item.checked).length;
        return [
          { key, label, href, complete: false, percent: Math.round((done / items.length) * 100) },
        ];
      }
    } catch {
      // corrupt JSON counts as incomplete
    }
  }
  return [empty(key, label, href)];
}

export async function getCompetitionStatus(groupId: string): Promise<SectionStatus[]> {
  const count = await prisma.competition.count({ where: { groupId } });
  if (count > 0) return [full("competitions", "Competition", "/student/competitions")];
  return [empty("competitions", "Competition", "/student/competitions")];
}

export async function getPaperStatus(groupId: string): Promise<SectionStatus[]> {
  const count = await prisma.paperPublication.count({ where: { groupId } });
  if (count > 0) return [full("papers", "Paper publication", "/student/papers")];
  return [empty("papers", "Paper publication", "/student/papers")];
}

export async function getSponsoredStatus(groupId: string): Promise<SectionStatus[]> {
  const key = "sponsored";
  const label = "Sponsored project";
  const href = "/student/sponsored";
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group || !group.isSponsored) return [];
  const [meetings, feedback] = await Promise.all([
    prisma.sponsoredMeeting.findMany({ where: { groupId } }),
    prisma.sponsorFeedback.findUnique({ where: { groupId } }),
  ]);
  const feedbackDone =
    Boolean(feedback?.company) &&
    (() => {
      try {
        const ratings = JSON.parse(feedback?.ratings ?? "{}") as Record<string, unknown>;
        return ["p1", "p2", "p3", "p4", "p5", "p6", "p7"].every(
          (k) => ratings[k] === "HIGH" || ratings[k] === "MEDIUM" || ratings[k] === "LOW",
        );
      } catch {
        return false;
      }
    })() &&
    Boolean(feedback?.sealUrl);
  const signedMeetings = meetings.filter((m) => m.guideSignedAt).length;
  const meetingsDone = meetings.length > 0 && signedMeetings >= meetings.length;
  const percent =
    meetings.length === 0
      ? feedbackDone
        ? 50
        : 0
      : Math.round((signedMeetings / meetings.length) * 50 + (feedbackDone ? 50 : 0));
  if (feedbackDone && meetingsDone) return [full(key, label, href)];
  return [{ key, label, href, complete: false, percent }];
}
