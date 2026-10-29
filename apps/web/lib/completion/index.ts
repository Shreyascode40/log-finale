import "server-only";

import { backendApi } from "@/lib/backend-api";

export type SectionStatus = {
  key: string;
  label: string;
  /** Student route for the stepper. */
  href: string;
  complete: boolean;
  /** 0–100. */
  percent: number;
};

export type GroupCompletion = {
  sections: SectionStatus[];
  /** Mean of section percents, 0-100. */
  percent: number;
  complete: boolean;
  /** Labels of incomplete sections, for the 403 message and dashboards. */
  missing: string[];
};

export type GuideGroupPending = {
  groupId: string;
  groupNo: string | null;
  projectTitle: string | null;
  status: string;
  percent: number;
  unverifiedEntries: number;
  topicsToScore: number;
  draftReviews: number;
  submittedReviews: number;
  openMockRows: number;
  openFinalRows: number;
  unsignedMeetings: number;
};

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

export function getGroupCompletion(groupId: string): Promise<GroupCompletion> {
  return backendApi<GroupCompletion>(`/v1/completion/groups/${encodeURIComponent(groupId)}`);
}

export async function getGroupCompletions(groupIds: string[]): Promise<Map<string, GroupCompletion>> {
  if (groupIds.length === 0) return new Map();
  const res = await backendApi<Record<string, GroupCompletion>>("/v1/completion/batch", {
    method: "POST",
    body: JSON.stringify({ groupIds }),
  });
  return new Map(Object.entries(res));
}

export function getGuideOverview(_guideId?: string): Promise<GuideGroupPending[]> {
  return backendApi<GuideGroupPending[]>("/v1/completion/guide-overview");
}

export function getHodOverview(): Promise<HodGroupRow[]> {
  return backendApi<HodGroupRow[]>("/v1/completion/hod-overview");
}
