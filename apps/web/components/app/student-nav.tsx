"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/student", label: "Dashboard" },
  { href: "/student/group", label: "My group" },
  { href: "/student/cover", label: "Cover" },
  { href: "/student/members", label: "Group info" },
  { href: "/student/rules", label: "Rules" },
  { href: "/student/undertaking", label: "Undertaking" },
  { href: "/student/schedule", label: "Schedule" },
  { href: "/student/topics", label: "Topics" },
  { href: "/student/activity/june", label: "Activity" },
  { href: "/student/reviews", label: "Reviews" },
  { href: "/student/mock", label: "Mock eval" },
  { href: "/student/final", label: "Final eval" },
  { href: "/student/examiner/TERM_I", label: "Examiner" },
  { href: "/student/competitions", label: "Competitions" },
  { href: "/student/papers", label: "Papers" },
  { href: "/student/checklists", label: "Checklists" },
  { href: "/student/rtm", label: "RTM" },
  { href: "/student/cost", label: "Cost" },
  { href: "/student/notes", label: "Notes" },
  { href: "/student/sponsored", label: "Sponsored" },
  { href: "/student/pdf", label: "PDF" },
];

export function StudentNav() {
  const pathname = usePathname();
  return (
    <nav className="border-b bg-white">
      <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4">
        {LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${
                active
                  ? "border-neutral-900 font-medium text-neutral-900"
                  : "border-transparent text-muted-foreground hover:text-neutral-900"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
