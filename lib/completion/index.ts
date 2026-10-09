import { prisma } from "@/lib/prisma";
import {
  getActivityStatus,
  getChecklistStatus,
  getCompetitionStatus,
  getContentStatus,
  getCoverStatus,
  getEvalStatus,
  getExaminerStatus,
  getMembersStatus,
  getPaperStatus,
  getReviewsStatus,
  getRulesStatus,
  getSponsoredStatus,
  getTopicsStatus,
  getUndertakingStatus,
  type SectionStatus,
} from "@/lib/completion/sections";

/**
 * Completion registry (F15). Aggregates every section into an overall percent
 * and answers "ready for PDF" (every mandatory section complete). The PDF
 * route (F16) gates on this plus the HOD permission.
 */

export type { SectionStatus };

export type GroupCompletion = {
  sections: SectionStatus[];
  /** Mean of section percents, 0–100. */
  percent: number;
  complete: boolean;
  /** Labels of incomplete sections, for the 403 message and dashboards. */
  missing: string[];
};

export async function getGroupCompletion(groupId: string): Promise<GroupCompletion> {
  const lists = await Promise.all([
    getCoverStatus(groupId),
    getMembersStatus(groupId),
    getRulesStatus(groupId),
    getUndertakingStatus(groupId),
    getTopicsStatus(groupId),
    getActivityStatus(groupId),
    getContentStatus(groupId, "RTM", "Requirement Traceability Matrix", "/student/rtm"),
    getContentStatus(groupId, "COST", "Project Cost Estimation", "/student/cost"),
    getReviewsStatus(groupId),
    getEvalStatus(groupId, "MOCK_T1", "mock", "Mock Evaluation (50)", "/student/mock"),
    getEvalStatus(groupId, "FINAL_T2", "final", "Final Evaluation (100)", "/student/final"),
    getExaminerStatus(groupId, "TERM_I", "examiner1", "Examiner Feedback Term-I"),
    getExaminerStatus(groupId, "TERM_II", "examiner2", "Examiner Feedback Term-II"),
    getChecklistStatus(groupId, "TERM_I", "checklist1", "Checklist Term-I"),
    getChecklistStatus(groupId, "TERM_II", "checklist2", "Checklist Term-II"),
    getCompetitionStatus(groupId),
    getPaperStatus(groupId),
    getSponsoredStatus(groupId),
  ]);
  const sections = lists.flat();
  const percent =
    sections.length === 0
      ? 0
      : Math.round(sections.reduce((sum, section) => sum + section.percent, 0) / sections.length);
  const missing = sections.filter((section) => !section.complete).map((section) => section.label);
  return { sections, percent, complete: missing.length === 0, missing };
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
export async function getGuideOverview(guideId: string): Promise<GuideGroupPending[]> {
  const groups = await prisma.group.findMany({
    where: { guideId },
    orderBy: { groupNo: "asc" },
  });
  return Promise.all(
    groups.map(async (group) => {
      const [entries, topics, forms, mockRows, finalRows, meetings, completion] =
        await Promise.all([
          prisma.activityEntry.findMany({
            where: { groupId: group.id, status: "STUDENT_CONFIRMED" },
            select: { id: true },
          }),
          prisma.topicProposal.findMany({
            where: { groupId: group.id, status: "SUBMITTED" },
            select: { id: true },
          }),
          prisma.reviewForm.findMany({
            where: { groupId: group.id },
            select: { status: true },
          }),
          prisma.marksSheet.findMany({
            where: { groupId: group.id, kind: "MOCK_T1" },
            select: { status: true },
          }),
          prisma.marksSheet.findMany({
            where: { groupId: group.id, kind: "FINAL_T2" },
            select: { status: true },
          }),
          prisma.sponsoredMeeting.findMany({
            where: { groupId: group.id },
            select: { studentSignedAt: true, guideSignedAt: true },
          }),
          getGroupCompletion(group.id),
        ]);
      return {
        groupId: group.id,
        groupNo: group.groupNo ?? null,
        projectTitle: group.projectTitle ?? null,
        status: group.status,
        percent: completion.percent,
        unverifiedEntries: entries.length,
        topicsToScore: topics.length,
        draftReviews: forms.filter((form) => form.status === "DRAFT").length,
        submittedReviews: forms.filter((form) => form.status === "SUBMITTED").length,
        openMockRows: mockRows.filter((row) => row.status !== "APPROVED").length,
        openFinalRows: finalRows.filter((row) => row.status !== "APPROVED").length,
        unsignedMeetings: meetings.filter((m) => m.studentSignedAt && !m.guideSignedAt).length,
      };
    }),
  );
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
    include: { guide: { select: { name: true } } },
  });
  return Promise.all(
    groups.map(async (group) => {
      const [topics, reviews, sheets, completion] = await Promise.all([
        prisma.topicProposal.count({ where: { groupId: group.id, status: "SCORED" } }),
        prisma.reviewForm.count({ where: { groupId: group.id, status: "SUBMITTED" } }),
        prisma.marksSheet.count({ where: { groupId: group.id, status: "SUBMITTED" } }),
        getGroupCompletion(group.id),
      ]);
      return {
        groupId: group.id,
        groupNo: group.groupNo ?? null,
        projectTitle: group.projectTitle ?? null,
        status: group.status,
        guideName: group.guide?.name ?? null,
        isSponsored: group.isSponsored,
        pdfPermission: group.pdfPermission,
        percent: completion.percent,
        ready: completion.complete,
        missing: completion.missing,
        submittedTopics: topics,
        submittedReviews: reviews,
        submittedSheets: sheets,
      };
    }),
  );
}
