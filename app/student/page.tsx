import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Student dashboard — Digital BE Log Book" };

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft — not submitted",
  SUBMITTED: "Submitted — awaiting HOD approval",
  ACTIVE: "Active",
  READY_FOR_PDF: "Ready for PDF",
  PDF_ALLOWED: "PDF allowed",
  PDF_GENERATED: "PDF generated",
};

export default async function StudentDashboardPage() {
  const user = await requireRole("STUDENT");

  const membership = await prisma.groupMember.findFirst({
    where: { userId: user.id },
    include: {
      group: { include: { guide: { select: { name: true } } , _count: { select: { members: true } } } },
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Welcome, {user.name}</CardTitle>
          <CardDescription>
            Your logbook dashboard. The section stepper and completion percent arrive with F15.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">My group</CardTitle>
          {membership ? (
            <CardDescription>
              {membership.group.groupNo ? `Group ${membership.group.groupNo}` : "Group"} ·{" "}
              {membership.group._count.members} member(s)
            </CardDescription>
          ) : (
            <CardDescription>You are not in a group yet.</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {membership ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <Badge>{STATUS_LABEL[membership.group.status] ?? membership.group.status}</Badge>
                <span className="text-muted-foreground">
                  Guide: {membership.group.guide?.name ?? "not assigned yet"}
                </span>
              </div>
              {membership.group.projectTitle ? (
                <p className="text-muted-foreground">{membership.group.projectTitle}</p>
              ) : null}
              <Button asChild variant="outline" size="sm">
                <Link href="/student/group">Open my group</Link>
              </Button>
            </>
          ) : (
            <Button asChild size="sm">
              <Link href="/student/group">Create or join a group</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
