"use server";

import { getCurrentUser } from "@/lib/permissions";
import { AppError } from "@/lib/errors";
import { listForUser, markAllRead } from "@/lib/services/notifications";

/** In-app inbox (F17): latest notifications and mark-all-read. */

export async function myNotificationsAction(limit = 20) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in");
    const data = await listForUser(user.id, typeof limit === "number" ? limit : 20);
    return { success: true, data } as const;
  } catch (error) {
    if (error instanceof AppError) return { success: false, error: error.message } as const;
    console.error("notifications action failed", error);
    return { success: false, error: "Something went wrong. Please try again." } as const;
  }
}

export async function markAllReadAction() {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in");
    await markAllRead(user.id);
    return { success: true, data: undefined } as const;
  } catch (error) {
    if (error instanceof AppError) return { success: false, error: error.message } as const;
    console.error("notifications action failed", error);
    return { success: false, error: "Something went wrong. Please try again." } as const;
  }
}
