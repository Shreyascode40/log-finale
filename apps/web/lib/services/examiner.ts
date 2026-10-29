import "server-only";

import type { Prisma } from "@prisma/client";
import { backendApi } from "@/lib/backend-api";
import type { ExaminerRating } from "@/lib/constants";
import type { Role } from "@/lib/roles";

export type ExaminerActor = { id: string; role: Role };

export type ExaminerSheet = {
  group: {
    id: string;
    groupNo: string | null;
    status: string;
    guideId: string | null;
  };
  guideName: string | null;
  projectTitle: string;
  date: string;
  answers: (ExaminerRating | null)[];
  remarks: string;
  externalName: string;
  internalName: string | null;
  signedAt: string | null;
};

const GUIDE_EXAMINER_ARGS = {
  include: { examinerFeedbacks: { select: { id: true, term: true } } },
} satisfies Prisma.GroupFindManyArgs;
type GuideExaminerGroup = Prisma.GroupGetPayload<typeof GUIDE_EXAMINER_ARGS>;

const QUEUE_EXAMINER_ARGS = {
  include: {
    guide: { select: { name: true } },
    examinerFeedbacks: { select: { id: true, term: true } },
  },
} satisfies Prisma.GroupFindManyArgs;
type QueueExaminerGroup = Prisma.GroupGetPayload<typeof QUEUE_EXAMINER_ARGS>;

const EXAMINER_OPEN_STATUSES = ["ACTIVE", "READY_FOR_PDF", "PDF_ALLOWED"];

export function examinerOpen(groupStatus: string): boolean {
  return EXAMINER_OPEN_STATUSES.includes(groupStatus);
}

export function getExaminerSheet(groupId: string, term: string) {
  return backendApi<ExaminerSheet>(
    `/v1/examiner/groups/${encodeURIComponent(groupId)}/${encodeURIComponent(term)}`,
  );
}

export function getStudentExaminerGroupId(_userId?: string) {
  return backendApi<string | null>("/v1/examiner/student-group");
}

export function listGuideExaminerGroups(_guideId?: string) {
  return backendApi<GuideExaminerGroup[]>("/v1/examiner/guide-groups");
}

export function listExaminerQueue() {
  return backendApi<QueueExaminerGroup[]>("/v1/examiner/hod-queue");
}

export async function saveExaminerFeedback(_actor: ExaminerActor, input: unknown): Promise<void> {
  await backendApi<{ success: true }>("/v1/examiner/save", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
