import "server-only";

import { backendApi } from "@/lib/backend-api";

/**
 * Notifications service (F17).
 * Client service calling the backend API.
 */

export type InboxItem = {
  id: string;
  type: string;
  message: string;
  at: string;
  read: boolean;
};

export async function listForUser(
  _userId?: string,
  limit = 20,
): Promise<{ items: InboxItem[]; unread: number }> {
  const take = Math.min(Math.max(limit, 1), 50);
  return backendApi<{ items: InboxItem[]; unread: number }>(`/v1/notifications?limit=${take}`);
}

export async function markAllRead(_userId?: string): Promise<void> {
  await backendApi<{ success: true }>("/v1/notifications/mark-read", {
    method: "POST",
  });
}
