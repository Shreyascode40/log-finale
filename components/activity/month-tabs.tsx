"use client";

import Link from "next/link";
import { ACTIVITY_MONTHS, ACTIVITY_MONTH_LABELS, type ActivityMonth } from "@/lib/constants";

/**
 * Month tabs for the activity charts (app chrome, outside the paper). One link
 * per logbook month; the current month prints bold. Hidden in print.
 */
export function MonthTabs({
  baseHref,
  current,
}: {
  /** e.g. "/student/activity" or "/guide/activity/<groupId>" — month appended. */
  baseHref: string;
  current: ActivityMonth;
}) {
  return (
    <nav aria-label="Activity months" className="print-hide border-b bg-white">
      <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
        {(ACTIVITY_MONTHS as readonly ActivityMonth[]).map((month) => {
          const active = month === current;
          return (
            <Link
              key={month}
              href={`${baseHref}/${month}`}
              aria-current={active ? "page" : undefined}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${
                active
                  ? "border-neutral-900 font-medium text-neutral-900"
                  : "border-transparent text-muted-foreground hover:text-neutral-900"
              }`}
            >
              {ACTIVITY_MONTH_LABELS[month]}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
