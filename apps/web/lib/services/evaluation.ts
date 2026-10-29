import "server-only";

import type { Prisma } from "@prisma/client";
import { backendApi } from "@/lib/backend-api";
import { FINAL_T2_COMPONENTS, MOCK_T1_COMPONENTS } from "@/lib/constants";
import type { Role } from "@/lib/roles";

export type EvalActor = { id: string; role: Role };

export type EvalKind = "MOCK_T1" | "FINAL_T2";

export type EvalComponent = { key: string; label: string; max: number };

export type EvalKindConfig = {
  kind: EvalKind;
  components: readonly EvalComponent[];
  auditPrefix: string;
};

export const EVAL_KINDS: Record<EvalKind, EvalKindConfig> = {
  MOCK_T1: { kind: "MOCK_T1", components: MOCK_T1_COMPONENTS, auditPrefix: "MOCK" },
  FINAL_T2: { kind: "FINAL_T2", components: FINAL_T2_COMPONENTS, auditPrefix: "FINAL" },
};

export type EvalRow = {
  memberId: string;
  memberName: string;
  components: Record<string, number | null>;
  total: number;
  status: string;
  approvedByName: string | null;
  approvedAt: string | null;
  unlockReason: string;
};

export type EvalSheet = {
  group: {
    id: string;
    groupNo: string | null;
    projectTitle: string | null;
    status: string;
    guideId: string | null;
  };
  guideName: string | null;
  rows: EvalRow[];
  submittedSign: { name: string | null; at: string | null };
};

export type EvalSaveRows = {
  groupId: string;
  rows: { memberId: string; components: Record<string, number | null | undefined> }[];
};

const GUIDE_EVAL_ARGS = {
  include: {
    markSheets: { select: { id: true, status: true } },
  },
} satisfies Prisma.GroupFindManyArgs;
type GuideEvalGroup = Prisma.GroupGetPayload<typeof GUIDE_EVAL_ARGS>;

const QUEUE_EVAL_ARGS = {
  include: {
    guide: { select: { name: true } },
    markSheets: { select: { id: true, status: true } },
  },
} satisfies Prisma.GroupFindManyArgs;
type EvalQueueGroup = Prisma.GroupGetPayload<typeof QUEUE_EVAL_ARGS>;

const EVAL_OPEN_STATUSES = ["ACTIVE", "READY_FOR_PDF", "PDF_ALLOWED"];

export function evalOpen(groupStatus: string): boolean {
  return EVAL_OPEN_STATUSES.includes(groupStatus);
}

export function getEvaluationSheet(groupId: string, kind: EvalKind) {
  return backendApi<EvalSheet>(
    `/v1/evaluation/groups/${encodeURIComponent(groupId)}/${encodeURIComponent(kind)}`,
  );
}

export function getStudentEvalGroupId(_userId?: string) {
  return backendApi<string | null>("/v1/evaluation/student-group");
}

export function listGuideEvalGroups(_guideId: string, kind: EvalKind) {
  return backendApi<GuideEvalGroup[]>(
    `/v1/evaluation/guide-groups/${encodeURIComponent(kind)}`,
  );
}

export function listEvalQueue(kind: EvalKind) {
  return backendApi<EvalQueueGroup[]>(
    `/v1/evaluation/hod-queue/${encodeURIComponent(kind)}`,
  );
}

export async function saveEvalSheets(
  _actor: EvalActor,
  kind: EvalKind,
  data: EvalSaveRows,
): Promise<void> {
  await backendApi<{ success: true }>("/v1/evaluation/save", {
    method: "POST",
    body: JSON.stringify({ kind, ...data }),
  });
}

export async function submitEvalSheets(
  _actor: EvalActor,
  kind: EvalKind,
  groupId: string,
): Promise<void> {
  await backendApi<{ success: true }>("/v1/evaluation/submit", {
    method: "POST",
    body: JSON.stringify({ kind, groupId }),
  });
}

export async function approveEvalSheets(
  _actor: EvalActor,
  kind: EvalKind,
  groupId: string,
): Promise<void> {
  await backendApi<{ success: true }>("/v1/evaluation/approve", {
    method: "POST",
    body: JSON.stringify({ kind, groupId }),
  });
}

export async function unlockEvalSheets(
  _actor: EvalActor,
  kind: EvalKind,
  groupId: string,
  reason: string,
): Promise<void> {
  await backendApi<{ success: true }>("/v1/evaluation/unlock", {
    method: "POST",
    body: JSON.stringify({ kind, groupId, reason }),
  });
}
