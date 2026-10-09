import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "HOD dashboard — Digital BE Log Book" };

export default async function HodDashboardPage() {
  const user = await requireRole("HOD");

  const [guides, students, submitted, active, drafts, recent] = await Promise.all([
    prisma.user.count({ where: { role: "GUIDE" } }),
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.group.count({ where: { status: "SUBMITTED" } }),
    prisma.group.count({ where: { status: "ACTIVE" } }),
    prisma.group.count({ where: { status: "DRAFT" } }),
    prisma.auditLog.findMany({
      orderBy: { timestamp: "desc" },
      take: 8,
      include: { user: { select: { name: true } } },
    }),
  ]);

  const stats = [
    { label: "Guide accounts", value: guides, href: "/hod/users" },
    { label: "Students", value: students, href: "/hod/users" },
    { label: "Awaiting approval", value: submitted, href: "/hod/groups" },
    { label: "Active groups", value: active, href: "/hod/groups" },
    { label: "Draft groups", value: drafts, href: "/hod/groups" },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Welcome, {user.name}</CardTitle>
          <CardDescription>Department-wide control of the logbook.</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="transition-colors hover:border-neutral-400">
              <CardContent className="p-4">
                <div className="text-2xl font-semibold">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent activity</CardTitle>
          <CardDescription>
            See the full trail in the{" "}
            <Link className="underline" href="/hod/audit">
              audit log
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <ul className="space-y-2">
              {recent.map((log) => (
                <li key={log.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2">
                    <Badge variant="secondary">{log.action}</Badge>
                    <span className="text-muted-foreground">
                      {log.user?.name ?? "system"} · {log.entity}
                    </span>
                  </span>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {log.timestamp.toLocaleString("en-GB")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
