import "server-only";

import { backendApi } from "@/lib/backend-api";
import type { CurrentUser } from "@/lib/permissions";

/**
 * HOD administration service (F3).
 * Client service calling the backend API.
 */

type Actor = Pick<CurrentUser, "id" | "role">;

export type GuideRow = {
  id: string;
  name: string;
  email: string;
  mobile: string | null;
  active: boolean;
  groups: number;
};

export type GuideOption = {
  id: string;
  name: string;
};

export type AssignmentRow = {
  id: string;
  groupNo: string | null;
  projectTitle: string | null;
  status: string;
  guideId: string | null;
  guideName: string | null;
};

export type GroupRow = {
  id: string;
  groupNo: string | null;
  projectTitle: string | null;
  area: string | null;
  status: string;
  rejectReason: string | null;
  isSponsored: boolean;
  guideName: string | null;
  creatorName: string;
  members: { id: string; name: string; rollNo: string | null }[];
};

export type AuditLogRow = {
  id: string;
  timestamp: string;
  action: string;
  entity: string;
  entityId: string | null;
  before: string | null;
  after: string | null;
  user: { name: string; email: string; role: string } | null;
};

export type AuditLogFilterResult = {
  logs: AuditLogRow[];
  entities: { entity: string }[];
  actions: { action: string }[];
};

export type HodDashboardStats = {
  guides: number;
  students: number;
  submitted: number;
  active: number;
  drafts: number;
};

export function createGuide(_actor: Actor, input: unknown): Promise<{ userId: string }> {
  return backendApi<{ userId: string }>("/v1/admin/guides", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateGuide(_actor: Actor, input: unknown): Promise<void> {
  return backendApi<void>("/v1/admin/guides", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function setUserActive(_actor: Actor, input: unknown): Promise<void> {
  return backendApi<void>("/v1/admin/users/active", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function approveGroup(_actor: Actor, input: unknown): Promise<{ groupId: string }> {
  return backendApi<{ groupId: string }>("/v1/admin/groups/approve", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function rejectGroup(_actor: Actor, input: unknown): Promise<void> {
  return backendApi<void>("/v1/admin/groups/reject", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function assignGuide(_actor: Actor, input: unknown): Promise<void> {
  return backendApi<void>("/v1/admin/groups/assign-guide", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function setGroupSponsored(_actor: Actor, input: unknown): Promise<void> {
  return backendApi<void>("/v1/admin/groups/sponsored", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function setPdfPermission(_actor: Actor, input: unknown): Promise<void> {
  return backendApi<void>("/v1/admin/groups/pdf-permission", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listGuides(): Promise<GuideRow[]> {
  return backendApi<GuideRow[]>("/v1/admin/guides");
}

export function listActiveGuides(): Promise<GuideOption[]> {
  return backendApi<GuideOption[]>("/v1/admin/guides/active");
}

export function listAssignments(): Promise<{ groups: AssignmentRow[]; guides: GuideOption[] }> {
  return backendApi<{ groups: AssignmentRow[]; guides: GuideOption[] }>("/v1/admin/assignments");
}

export function listAdminGroups(): Promise<{ groups: GroupRow[]; guides: GuideOption[] }> {
  return backendApi<{ groups: GroupRow[]; guides: GuideOption[] }>("/v1/admin/groups");
}

export function listAuditLogs(
  query: { entity?: string; action?: string; user?: string } = {},
): Promise<AuditLogFilterResult> {
  const params = new URLSearchParams();
  if (query.entity) params.set("entity", query.entity);
  if (query.action) params.set("action", query.action);
  if (query.user) params.set("user", query.user);
  const qs = params.toString();
  return backendApi<AuditLogFilterResult>(`/v1/admin/audit${qs ? `?${qs}` : ""}`);
}

export function getHodDashboardStats(): Promise<HodDashboardStats> {
  return backendApi<HodDashboardStats>("/v1/admin/stats");
}
