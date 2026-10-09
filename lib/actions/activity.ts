"use server";

import { getCurrentUser } from "@/lib/permissions";
import { listRecentActivity, type ActivityItem } from "@/lib/services/activity";

/**
 * Server action behind the auto-refreshing "Recent activity" panel. The scope is
 * resolved from the signed-in user on the server, so a client can never ask for
 * another role's feed.
 */

export type ActivityResult = { success: true; data: ActivityItem[] } | { success: false; error: string };

export async function getRecentActivityAction(input?: { limit?: number }): Promise<ActivityResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Not signed in" };
    const data = await listRecentActivity({ id: user.id, role: user.role }, input?.limit ?? 12);
    return { success: true, data };
  } catch (error) {
    console.error("recent activity failed", error);
    return { success: false, error: "Could not load recent activity" };
  }
}
