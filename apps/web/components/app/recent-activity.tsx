"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getRecentActivityAction } from "@/lib/actions/activity";
import type { ActivityItem } from "@/lib/services/activity";

const REFRESH_MS = 10_000;

/** "just now" / "5 min ago" / "2 h ago" / a date. */
function timeAgo(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString("en-GB");
}

function clock(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export type RecentActivityCardProps = {
  initial: ActivityItem[];
  limit?: number;
  description?: ReactNode;
};

/**
 * "Recent activity" panel. The server fetches the first page; the browser then
 * polls every 10s (and on focus) so the feed stays current without a reload.
 * The role scoping happens on the server, so the payload is already filtered.
 */
export function RecentActivityCard({ initial, limit = 12, description }: RecentActivityCardProps) {
  const [items, setItems] = useState<ActivityItem[]>(initial);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [live, setLive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const result = await getRecentActivityAction({ limit });
    if (result.success) {
      setItems(result.data);
      setUpdatedAt(new Date().toISOString());
      setError(null);
    } else {
      setError(result.error);
    }
  }, [limit]);

  useEffect(() => {
    if (!live) return;
    const timer = setInterval(refresh, REFRESH_MS);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh, live]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">Recent activity</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        <button
          type="button"
          onClick={() => setLive((value) => !value)}
          className="flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs text-muted-foreground hover:text-neutral-900"
          title={live ? "Pause auto-refresh" : "Resume auto-refresh"}
        >
          <span
            aria-hidden
            className={`inline-block h-2 w-2 rounded-full ${live ? "bg-green-500" : "bg-neutral-400"}`}
          />
          {live ? "Live" : "Paused"}
        </button>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <Badge variant="secondary">{item.action}</Badge>
                  <span className="truncate text-muted-foreground">
                    {item.actorName} {item.summary}
                  </span>
                </span>
                <span className="whitespace-nowrap text-xs text-muted-foreground" suppressHydrationWarning>
                  {timeAgo(item.at)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-right text-[11px] text-muted-foreground" suppressHydrationWarning>
          {error
            ? error
            : live
              ? updatedAt
                ? `Updated ${clock(updatedAt)} · refreshes every 10s`
                : "Refreshes every 10s"
              : "Auto-refresh paused"}
        </p>
      </CardContent>
    </Card>
  );
}
