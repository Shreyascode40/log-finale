"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/student", label: "Dashboard" },
  { href: "/student/group", label: "My group" },
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
