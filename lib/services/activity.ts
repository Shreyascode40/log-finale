import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";

/**
 * Recent activity feed (F7+). Reads the AuditLog, scoped to what each role may
 * see:
 *   - HOD   -> the whole system
 *   - GUIDE -> the groups assigned to them (plus their own actions and schedule)
 *   - STUDENT -> their own group (plus their own actions and schedule)
 *
 * The AuditLog stores a bare entity/entityId, so group scoping resolves the
 * actor's groups, then their members and invites, and matches those ids.
 */

export type ActivityActor = { id: string; role: Role };

export type ActivityItem = {
  id: string;
  action: string;
  entity: string;
  actorName: string;
  /** Human-readable phrase, e.g. "submitted the group for approval". */
  summary: string;
  /** ISO timestamp. */
  at: string;
};

const ACTION_LABELS: Record<string, string> = {
  USER_SIGNUP: "signed up",
  EMAIL_VERIFIED: "verified their email",
  PASSWORD_RESET: "reset their password",
  GUIDE_CREATE: "created a guide account",
  GUIDE_UPDATE: "updated a guide account",
  USER_ACTIVATE: "activated a user",
  USER_DEACTIVATE: "deactivated a user",
  GROUP_CREATE: "created a group",
  GROUP_INVITE: "invited a member",
  GROUP_INVITE_DECLINE: "declined an invitation",
  GROUP_MEMBER_REMOVE: "removed a member",
  GROUP_SUBMIT: "submitted the group for approval",
  GROUP_APPROVE: "approved the group",
  GROUP_REJECT: "rejected the group",
  GROUP_ASSIGN_GUIDE: "assigned a guide",
  GROUP_REASSIGN_GUIDE: "reassigned the guide",
  RULES_ACK: "acknowledged the rules",
  UNDERTAKING_ACCEPT: "accepted the undertaking",
  COVER_UPDATE: "updated the cover sheet",
  MEMBER_UPDATE: "updated group information",
  MEMBER_PHOTO_UPDATE: "updated a member photo",
  SCHEDULE_UPDATE: "updated the schedule",
  TOPIC_SAVE: "saved a project topic",
  TOPIC_SUBMIT: "submitted a project topic",
  TOPIC_SCORE: "scored a project topic",
  TOPIC_APPROVE: "approved a project topic",
  TOPIC_REJECT: "rejected a project topic",
  ENTRY_CONFIRM: "confirmed an activity row",
  ENTRY_VERIFY: "verified an activity row",
  REVIEW_SAVE: "edited a review draft",
  REVIEW_SUBMIT: "submitted a review",
  REVIEW_APPROVE: "approved a review",
  REVIEW_UNLOCK: "unlocked a review",
  MOCK_SAVE: "edited the mock table",
  MOCK_SUBMIT: "submitted the mock table",
  MOCK_APPROVE: "approved the mock table",
  MOCK_UNLOCK: "unlocked the mock table",
  FINAL_SAVE: "edited the final table",
  FINAL_SUBMIT: "submitted the final table",
  FINAL_APPROVE: "approved the final table",
  FINAL_UNLOCK: "unlocked the final table",
  EXAMINER_SAVE: "recorded examiner feedback",
  COMPETITION_CREATE: "added a competition",
  COMPETITION_UPDATE: "updated a competition",
  COMPETITION_DELETE: "deleted a competition",
  COMPETITION_CERTIFICATE: "uploaded a competition certificate",
  PAPER_CREATE: "added a paper",
  PAPER_UPDATE: "updated a paper",
  PAPER_DELETE: "deleted a paper",
  PAPER_FILE: "uploaded a paper file",
  CHECKLIST_SAVE: "updated a checklist",
  CONTENT_SAVE: "updated a content page",
  CONTENT_FILE: "uploaded a content file",
  NOTE_CREATE: "added a note",
  NOTE_UPDATE: "updated a note",
  NOTE_DELETE: "deleted a note",
  GROUP_SPONSORED: "toggled the sponsored flag",
  GROUP_PDF_ALLOW: "allowed PDF generation",
  GROUP_PDF_REVOKE: "revoked PDF permission",
  PDF_GENERATE: "generated the final PDF",
  MEETING_CREATE: "logged a sponsor meeting",
  MEETING_UPDATE: "updated a sponsor meeting",
  MEETING_DELETE: "deleted a sponsor meeting",
  MEETING_SIGN: "signed a sponsor meeting",
  MEETING_GUIDE_SIGN: "countersigned a sponsor meeting",
  MEETING_EXTERNAL_SIGN: "recorded an external guide signature",
  SPONSOR_FEEDBACK_SAVE: "saved the sponsor feedback",
  SPONSOR_SEAL: "uploaded the sponsor seal",
};

function summarise(action: string): string {
  return ACTION_LABELS[action] ?? action.toLowerCase().replace(/_/g, " ");
}

/** Builds the Prisma `where` clause that scopes the audit trail to `actor`. */
async function activityWhere(actor: ActivityActor): Promise<Prisma.AuditLogWhereInput> {
  if (actor.role === "HOD") return {};

  const groups = await prisma.group.findMany({
    where:
      actor.role === "GUIDE"
        ? { guideId: actor.id }
        : { members: { some: { userId: actor.id } } },
    select: { id: true },
  });
  const groupIds = groups.map((group) => group.id);

  const [members, invites, entries, topics, forms, sheets, feedback, competitions, papers, checklists, pages, meetings, sponsorRows, pdfs] =
    await Promise.all([
    groupIds.length
      ? prisma.groupMember.findMany({ where: { groupId: { in: groupIds } }, select: { id: true } })
      : Promise.resolve([]),
    groupIds.length
      ? prisma.groupInvite.findMany({ where: { groupId: { in: groupIds } }, select: { id: true } })
      : Promise.resolve([]),
    groupIds.length
      ? prisma.activityEntry.findMany({
          where: { groupId: { in: groupIds } },
          select: { id: true },
        })
      : Promise.resolve([]),
    groupIds.length
      ? prisma.topicProposal.findMany({ where: { groupId: { in: groupIds } }, select: { id: true } })
      : Promise.resolve([]),
    groupIds.length
      ? prisma.reviewForm.findMany({ where: { groupId: { in: groupIds } }, select: { id: true } })
      : Promise.resolve([]),
    groupIds.length
      ? prisma.marksSheet.findMany({ where: { groupId: { in: groupIds } }, select: { id: true } })
      : Promise.resolve([]),
    groupIds.length
      ? prisma.examinerFeedback.findMany({
          where: { groupId: { in: groupIds } },
          select: { id: true },
        })
      : Promise.resolve([]),
    groupIds.length
      ? prisma.competition.findMany({ where: { groupId: { in: groupIds } }, select: { id: true } })
      : Promise.resolve([]),
    groupIds.length
      ? prisma.paperPublication.findMany({
          where: { groupId: { in: groupIds } },
          select: { id: true },
        })
      : Promise.resolve([]),
    groupIds.length
      ? prisma.checklist.findMany({ where: { groupId: { in: groupIds } }, select: { id: true } })
      : Promise.resolve([]),
    groupIds.length
      ? prisma.contentPage.findMany({ where: { groupId: { in: groupIds } }, select: { id: true } })
      : Promise.resolve([]),
    groupIds.length
      ? prisma.sponsoredMeeting.findMany({
          where: { groupId: { in: groupIds } },
          select: { id: true },
        })
      : Promise.resolve([]),
    groupIds.length
      ? prisma.sponsorFeedback.findMany({ where: { groupId: { in: groupIds } }, select: { id: true } })
      : Promise.resolve([]),
    groupIds.length
      ? prisma.pdfExport.findMany({ where: { groupId: { in: groupIds } }, select: { id: true } })
      : Promise.resolve([]),
  ]);

  return {
    OR: [
      { userId: actor.id },
      { entity: "ScheduleItem" },
      { entity: "Group", entityId: { in: groupIds } },
      { entity: "GroupMember", entityId: { in: members.map((m) => m.id) } },
      { entity: "GroupInvite", entityId: { in: invites.map((i) => i.id) } },
      { entity: "ActivityEntry", entityId: { in: entries.map((e) => e.id) } },
      { entity: "TopicProposal", entityId: { in: topics.map((t) => t.id) } },
      { entity: "ReviewForm", entityId: { in: forms.map((f) => f.id) } },
      { entity: "MarksSheet", entityId: { in: sheets.map((s) => s.id) } },
      { entity: "ExaminerFeedback", entityId: { in: feedback.map((f) => f.id) } },
      { entity: "Competition", entityId: { in: competitions.map((c) => c.id) } },
      { entity: "PaperPublication", entityId: { in: papers.map((p) => p.id) } },
      { entity: "Checklist", entityId: { in: checklists.map((c) => c.id) } },
      { entity: "ContentPage", entityId: { in: pages.map((p) => p.id) } },
      { entity: "SponsoredMeeting", entityId: { in: meetings.map((m) => m.id) } },
      { entity: "SponsorFeedback", entityId: { in: sponsorRows.map((s) => s.id) } },
      { entity: "PdfExport", entityId: { in: pdfs.map((p) => p.id) } },
    ],
  };
}

/** Newest-first activity the actor may see. */
export async function listRecentActivity(actor: ActivityActor, limit = 12): Promise<ActivityItem[]> {
  const take = Math.min(Math.max(limit, 1), 50);

  const logs = await prisma.auditLog.findMany({
    where: await activityWhere(actor),
    orderBy: { timestamp: "desc" },
    take,
    include: { user: { select: { name: true } } },
  });

  return logs.map((log) => ({
    id: log.id,
    action: log.action,
    entity: log.entity,
    actorName: log.user?.name ?? "System",
    summary: summarise(log.action),
    at: log.timestamp.toISOString(),
  }));
}
