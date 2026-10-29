import "server-only";

import type { Prisma } from "@prisma/client";
import { backendApi } from "@/lib/backend-api";
import type { Role } from "@/lib/roles";

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

const topicListArgs = {
  include: { topics: { orderBy: { topicNo: "asc" } } },
} satisfies Prisma.GroupFindManyArgs;
type TopicListGroup = Prisma.GroupGetPayload<typeof topicListArgs>;

const topicQueueArgs = {
  include: {
    guide: { select: { name: true } },
    topics: { orderBy: { topicNo: "asc" } },
  },
} satisfies Prisma.GroupFindManyArgs;
type TopicQueueGroup = Prisma.GroupGetPayload<typeof topicQueueArgs>;

const TOPIC_OPEN_STATUSES = ["ACTIVE", "READY_FOR_PDF", "PDF_ALLOWED"];
export function topicsOpen(groupStatus: string): boolean {
  return TOPIC_OPEN_STATUSES.includes(groupStatus);
}

export function getTopicSheet(groupId: string) {
  return backendApi<TopicSheet>(`/v1/topics/group/${encodeURIComponent(groupId)}`);
}

export function getStudentTopicGroupId(_userId: string) {
  return backendApi<string | null>("/v1/topics/student-group");
}

export function listGuideTopicGroups(_guideId: string) {
  return backendApi<TopicListGroup[]>("/v1/topics/guide-groups");
}

export function listTopicQueue() {
  return backendApi<TopicQueueGroup[]>("/v1/topics/hod-queue");
}

export async function saveTopic(_actor: TopicActor, input: unknown): Promise<void> {
  await backendApi<{ success: true }>("/v1/topics/save", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function scoreTopic(_actor: TopicActor, input: unknown): Promise<void> {
  await backendApi<{ success: true }>("/v1/topics/score", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function decideTopic(_actor: TopicActor, input: unknown): Promise<void> {
  await backendApi<{ success: true }>("/v1/topics/decide", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
