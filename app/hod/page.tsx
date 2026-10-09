import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { listRecentActivity } from "@/lib/services/activity";
import { getHodOverview } from "@/lib/completion/index";
import { RecentActivityCard } from "@/components/app/recent-activity";
import { PdfToggle } from "@/components/hod/pdf-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "HOD dashboard — Digital BE Log Book" };

/**
 * HOD dashboard (F15): every group with its guide, completion percent and
 * readiness; approval queues for topics, reviews and mark sheets; per-group
 * PDF permission toggles. User management, assignments, schedule editing and
 * the audit log keep their own pages.
 */
export default async function HodDashboardPage() {
  const user = await requireRole("HOD");

  const [groups, guides, students, submitted, active, drafts, recent] = await Promise.all([
    getHodOverview(),
    prisma.user.count({ where: { role: "GUIDE" } }),
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.group.count({ where: { status: "SUBMITTED" } }),
    prisma.group.count({ where: { status: "ACTIVE" } }),
    prisma.group.count({ where: { status: "DRAFT" } }),
    listRecentActivity({ id: user.id, role: user.role }, 8),
  ]);

  const queueTopics = groups.reduce((sum, group) => sum + group.submittedTopics, 0);
  const queueReviews = groups.reduce((sum, group) => sum + group.submittedReviews, 0);
  const queueSheets = groups.reduce((sum, group) => sum + group.submittedSheets, 0);

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
          <CardTitle className="text-base">Approval queue</CardTitle>
          <CardDescription>Topics, reviews and mark sheets awaiting a decision.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-sm">
          <Button asChild variant="outline" size="sm">
            <Link href="/hod/topics">Topics to decide: {queueTopics}</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/hod/reviews">Reviews to decide: {queueReviews}</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/hod/mock">Mark sheets to decide: {queueSheets}</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/hod/groups">Groups to approve: {submitted}</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All groups</CardTitle>
          <CardDescription>
            Completion percent, readiness and PDF permission per group.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No groups yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Group</TableHead>
                  <TableHead>Guide</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Complete</TableHead>
                  <TableHead>Ready</TableHead>
                  <TableHead className="text-right">PDF permission</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((group) => (
                  <TableRow key={group.groupId}>
                    <TableCell className="font-medium">
                      {group.groupNo ? `Group ${group.groupNo}` : "Group"}
                      {group.projectTitle ? (
                        <div className="max-w-[14rem] truncate text-xs font-normal text-muted-foreground">
                          {group.projectTitle}
                        </div>
                      ) : null}
                      {group.isSponsored ? (
                        <Badge variant="outline" className="mt-1">
                          Sponsored
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {group.guideName ?? "Not assigned"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{group.status.replaceAll("_", " ")}</Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">{group.percent}%</TableCell>
                    <TableCell>
                      {group.ready ? (
                        <Badge>Ready for PDF</Badge>
                      ) : (
                        <span
                          className="text-xs text-muted-foreground"
                          title={group.missing.join(", ")}
                        >
                          {group.missing.length} missing
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <PdfToggle groupId={group.groupId} allowed={group.pdfPermission} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <RecentActivityCard
        initial={recent}
        limit={8}
        description={
          <>
            See the full trail in the{" "}
            <Link className="underline" href="/hod/audit">
              audit log
            </Link>
            .
          </>
        }
      />
    </div>
  );
}
