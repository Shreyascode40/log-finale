"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function AppHeader({
  name,
  role,
  homeHref,
}: {
  name: string;
  role: string;
  homeHref: string;
}) {
  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <div className="min-w-0">
          <Link href={homeHref} className="truncate text-sm font-semibold">
            Digital BE Project Log Book
          </Link>
          <p className="truncate text-xs text-muted-foreground">
            Anantrao Pawar College of Engineering &amp; Research
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right text-xs">
            <div className="font-medium">{name}</div>
            <div className="text-muted-foreground">{role}</div>
          </div>
          <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
