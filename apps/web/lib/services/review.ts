import "server-only";

import type { Prisma } from "@prisma/client";
import { backendApi } from "@/lib/backend-api";
import type { Role } from "@/lib/roles";

export type ReviewActor = { id: string; role: Role };

export type ReviewScoreRow = {
  questionId: string;
  questionNo: number;
  text: string;
  remark: string;
  grade: string;
  date: string;
  signedByName: string | null;
  signedAt: string | null;
};

export type ReviewSheet = {
  group: {
    id: string;
    groupNo: string | null;
    projectTitle: string | null;
    status: string;
    guideId: string | null;
  };
  guideName: string | null;
  template: { reviewType: string; title: string; term: string; hasDateColumn: boolean };
  form: {
    status: string;
    remarkAndSuggestions: string;
    submittedByName: string | null;
    submittedAt: string | null;
    approvedByName: string | null;
    approvedAt: string | null;
    unlockReason: string;
  };
  scores: ReviewScoreRow[];
};

export type ReviewStatusItem = {
  reviewType: string;
  title: string;
  term: string;
  status: string;
};

const GUIDE_GROUP_ARGS = {
  include: {
    reviewForms: {
      include: { template: { select: { reviewType: true, title: true } } },
    },
  },
} satisfies Prisma.GroupFindManyArgs;
type GuideReviewGroup = Prisma.GroupGetPayload<typeof GUIDE_GROUP_ARGS>;

const QUEUE_GROUP_ARGS = {
  include: {
    guide: { select: { name: true } },
    reviewForms: {
      include: { template: { select: { reviewType: true, title: true } } },
    },
  },
} satisfies Prisma.GroupFindManyArgs;
type ReviewQueueGroup = Prisma.GroupGetPayload<typeof QUEUE_GROUP_ARGS>;

const REVIEW_OPEN_STATUSES = ["ACTIVE", "READY_FOR_PDF", "PDF_ALLOWED"];

export function reviewsOpen(groupStatus: string): boolean {
  return REVIEW_OPEN_STATUSES.includes(groupStatus);
}

export function getReviewSheet(groupId: string, reviewType: string) {
  return backendApi<ReviewSheet>(
    `/v1/reviews/groups/${encodeURIComponent(groupId)}/${encodeURIComponent(reviewType)}`,
  );
}

export function listGroupReviewStatuses(groupId: string) {
  return backendApi<ReviewStatusItem[]>(
    `/v1/reviews/groups/${encodeURIComponent(groupId)}/statuses`,
  );
}

export function getStudentReviewGroupId(_userId?: string) {
  return backendApi<string | null>("/v1/reviews/student-group");
}

export function listGuideReviewGroups(_guideId?: string) {
  return backendApi<GuideReviewGroup[]>("/v1/reviews/guide-groups");
}

export function listReviewQueue() {
  return backendApi<ReviewQueueGroup[]>("/v1/reviews/hod-queue");
}

export async function saveReviewDraft(_actor: ReviewActor, input: unknown): Promise<void> {
  await backendApi<{ success: true }>("/v1/reviews/draft", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function submitReview(_actor: ReviewActor, input: unknown): Promise<void> {
  await backendApi<{ success: true }>("/v1/reviews/submit", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function approveReview(_actor: ReviewActor, input: unknown): Promise<void> {
  await backendApi<{ success: true }>("/v1/reviews/approve", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function unlockReview(_actor: ReviewActor, input: unknown): Promise<void> {
  await backendApi<{ success: true }>("/v1/reviews/unlock", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
