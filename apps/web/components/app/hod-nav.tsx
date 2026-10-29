"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/hod", label: "Overview" },
  { href: "/hod/users", label: "Users" },
  { href: "/hod/groups", label: "Groups" },
  { href: "/hod/assignments", label: "Assignments" },
  { href: "/hod/schedule", label: "Schedule" },
  { href: "/hod/topics", label: "Topics" },
  { href: "/hod/activity", label: "Activity" },
  { href: "/hod/reviews", label: "Reviews" },
  { href: "/hod/mock", label: "Mock eval" },
  { href: "/hod/final", label: "Final eval" },
  { href: "/hod/examiner", label: "Examiner" },
  { href: "/hod/records", label: "Records" },
  { href: "/hod/gallery", label: "Gallery" },
  { href: "/hod/sponsored", label: "Sponsored" },
  { href: "/hod/audit", label: "Audit log" },
];

export function HodNav() {
  const pathname = usePathname();
  return (
    <nav className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
        {LINKS.map((link) => {
          const active =
            pathname === link.href ||
            (link.href === "/hod/gallery" && pathname.startsWith("/hod/gallery/"));
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
