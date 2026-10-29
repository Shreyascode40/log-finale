import "server-only";

import type { Prisma } from "@prisma/client";
import { backendApi } from "@/lib/backend-api";
import type { Role } from "@/lib/roles";

/**
 * Sponsored project sheets (F14, SPEC.md B13).
 * Client service calling the backend API.
 */

export type SponsoredActor = { id: string; role: Role };

export type MeetingSign = { name: string | null; at: string | null };

export type MeetingRow = {
  id: string;
  sortOrder: number;
  date: string;
  summaryPrev: string;
  summaryNext: string;
  studentSign: MeetingSign | null;
  guideSign: MeetingSign | null;
  externalSignAt: string | null;
};

export type SponsoredSheet = {
  group: {
    id: string;
    groupNo: string | null;
    projectTitle: string | null;
    status: string;
    guideId: string | null;
    isSponsored: boolean;
  };
  guideName: string | null;
  semesters: { semester: "SEMESTER_1" | "SEMESTER_2"; title: string; rows: MeetingRow[] }[];
  feedback: {
    company: string;
    ratings: Record<string, string | null>;
    sealUrl: string | null;
    signedAt: string | null;
  };
};

const GUIDE_SPONSORED_ARGS = {
  include: { sponsoredMeetings: { select: { id: true, guideSignedAt: true } } },
} satisfies Prisma.GroupFindManyArgs;
export type GuideSponsoredGroup = Prisma.GroupGetPayload<typeof GUIDE_SPONSORED_ARGS>;

const QUEUE_SPONSORED_ARGS = {
  include: {
    guide: { select: { name: true } },
    sponsoredMeetings: { select: { id: true } },
  },
} satisfies Prisma.GroupFindManyArgs;
export type QueueSponsoredGroup = Prisma.GroupGetPayload<typeof QUEUE_SPONSORED_ARGS>;

type SponsoredMeeting = Prisma.SponsoredMeetingGetPayload<{}>;

/** The full sponsored bundle for a group (empty rows when not sponsored). */
export function getSponsoredSheet(groupId: string): Promise<SponsoredSheet> {
  return backendApi<SponsoredSheet>(`/v1/sponsored/groups/${encodeURIComponent(groupId)}`);
}

/** The single group a student belongs to. */
export function getStudentSponsoredGroupId(_userId?: string): Promise<string | null> {
  return backendApi<string | null>("/v1/sponsored/student-group");
}

/** Assigned groups, for the guide countersign index. */
export function listGuideSponsoredGroups(_guideId?: string): Promise<GuideSponsoredGroup[]> {
  return backendApi<GuideSponsoredGroup[]>("/v1/sponsored/guide-groups");
}

/** Every group, for the HOD index (sponsored ones carry the sheets). */
export function listSponsoredQueue(): Promise<QueueSponsoredGroup[]> {
  return backendApi<QueueSponsoredGroup[]>("/v1/sponsored/hod-queue");
}

export function saveMeeting(_actor: SponsoredActor, input: unknown): Promise<SponsoredMeeting> {
  return backendApi<SponsoredMeeting>("/v1/sponsored/meetings", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteMeeting(_actor: SponsoredActor, input: unknown): Promise<{ success: true }> {
  return backendApi<{ success: true }>("/v1/sponsored/meetings/delete", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function signMeetingStudent(
  _actor: SponsoredActor,
  input: unknown,
): Promise<{ name: string; at: string }> {
  return backendApi<{ name: string; at: string }>("/v1/sponsored/meetings/sign-student", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function signMeetingGuide(
  _actor: SponsoredActor,
  input: unknown,
): Promise<{ name: string | null; at: string }> {
  return backendApi<{ name: string | null; at: string }>("/v1/sponsored/meetings/sign-guide", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function recordExternalSign(
  _actor: SponsoredActor,
  input: unknown,
): Promise<{ at: string }> {
  return backendApi<{ at: string }>("/v1/sponsored/meetings/record-external-sign", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function saveSponsorFeedback(
  _actor: SponsoredActor,
  input: unknown,
): Promise<{ signedAt: string | null }> {
  return backendApi<{ signedAt: string | null }>("/v1/sponsored/feedback", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function uploadSeal(_actor: SponsoredActor, file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const res = await backendApi<{ url: string }>("/v1/sponsored/seal", {
    method: "PUT",
    headers: { "content-type": file.type },
    body: bytes,
  });
  return res.url;
}
