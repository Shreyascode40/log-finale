import "server-only";

import type { Prisma } from "@prisma/client";
import { backendApi } from "@/lib/backend-api";
import { ACTIVITY_MONTHS, type ActivityMonth } from "@/lib/constants";
import type { Role } from "@/lib/roles";

export type ActivityChartActor = { id: string; role: Role };
export type ChartSign = { name: string | null; at: string | null };
export type ChartEntry = {
  id: string;
  sortOrder: number;
  text: string;
  date: string;
  status: string;
  statusText: "COMPLETE" | "INCOMPLETE" | null;
  studentSign: ChartSign | null;
  guideSign: ChartSign | null;
};
export type MonthChart = {
  group: { id: string; groupNo: string | null; status: string; guideId: string | null };
  guideName: string | null;
  month: ActivityMonth;
  entries: ChartEntry[];
};
export type ConfirmResult = { status: string; studentName: string | null; studentConfirmedAt: string };
export type VerifyResult = { status: string; guideName: string | null; guideVerifiedAt: string };

const GUIDE_GROUP_ARGS = {
  include: { activityEntries: { select: { id: true, month: true, status: true } } },
} satisfies Prisma.GroupFindManyArgs;
type GuideChartGroup = Prisma.GroupGetPayload<typeof GUIDE_GROUP_ARGS>;
const QUEUE_GROUP_ARGS = {
  include: {
    guide: { select: { name: true } },
    activityEntries: { select: { id: true, month: true, status: true } },
  },
} satisfies Prisma.GroupFindManyArgs;
type QueueChartGroup = Prisma.GroupGetPayload<typeof QUEUE_GROUP_ARGS>;

const CHART_OPEN_STATUSES = ["ACTIVE", "READY_FOR_PDF", "PDF_ALLOWED"];
export function chartsOpen(groupStatus: string): boolean {
  return CHART_OPEN_STATUSES.includes(groupStatus);
}
export function isChartMonth(value: string): value is ActivityMonth {
  return (ACTIVITY_MONTHS as readonly string[]).includes(value);
}

export function getMonthChart(groupId: string, month: ActivityMonth) {
  return backendApi<MonthChart>(
    `/v1/activity-charts/groups/${encodeURIComponent(groupId)}/${encodeURIComponent(month)}`,
  );
}
export function getStudentChartGroupId(_userId: string) {
  return backendApi<string | null>("/v1/activity-charts/student-group");
}
export function listGuideChartGroups(_guideId: string) {
  return backendApi<GuideChartGroup[]>("/v1/activity-charts/guide-groups");
}
export function listChartQueue() {
  return backendApi<QueueChartGroup[]>("/v1/activity-charts/hod-queue");
}
export function confirmEntry(_actor: ActivityChartActor, input: unknown) {
  return backendApi<ConfirmResult>("/v1/activity-charts/confirm", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
export function verifyEntry(_actor: ActivityChartActor, input: unknown) {
  return backendApi<VerifyResult>("/v1/activity-charts/verify", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
