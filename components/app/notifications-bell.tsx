"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { markAllReadAction, myNotificationsAction } from "@/lib/actions/notifications";
import { formatDateTime } from "@/lib/format";

type InboxItem = {
  id: string;
  type: string;
  message: string;
  at: string;
  read: boolean;
};

/**
 * In-app notification bell (F17). Polls the inbox every 30 seconds, shows the
 * unread count, lists the latest events and marks everything read on demand.
 */
export function NotificationsBell() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  async function load() {
    const result = await myNotificationsAction(20);
    if (result.success) {
      setItems(result.data.items);
      setUnread(result.data.unread);
    }
  }

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 30000);
    return () => clearInterval(timer);
  }, []);

  async function readAll() {
    await markAllReadAction();
    await load();
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="relative" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unread > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-96 w-80 overflow-y-auto">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unread > 0 ? (
            <button
              type="button"
              onClick={() => void readAll()}
              className="text-xs font-normal text-muted-foreground hover:text-neutral-900 hover:underline"
            >
              Mark all read
            </button>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">No notifications yet.</p>
        ) : (
          items.map((item) => (
            <DropdownMenuItem
              key={item.id}
              className={`flex flex-col items-start gap-0.5 whitespace-normal ${item.read ? "" : "bg-neutral-100"}`}
              onSelect={(e) => e.preventDefault()}
            >
              <span className="text-xs">{item.message}</span>
              <span className="text-[10px] text-muted-foreground">{formatDateTime(item.at)}</span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
