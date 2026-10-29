import "server-only";

import { backendApi } from "@/lib/backend-api";
import type { Role } from "@/lib/roles";

export type ActivityActor = { id: string; role: Role };

export type ActivityItem = {
  id: string;
  action: string;
  entity: string;
  actorName: string;
  summary: string;
  at: string;
};

/** Role-scoped audit feed. The API resolves the identity and role from its DB. */
export function listRecentActivity(_actor: ActivityActor, limit = 12) {
  return backendApi<ActivityItem[]>(`/v1/activity?limit=${encodeURIComponent(String(limit))}`);
}
