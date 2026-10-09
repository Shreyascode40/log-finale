import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { listRecentActivity } from "@/lib/services/activity";
import { getGroupCompletion } from "@/lib/completion/index";
import { RecentActivityCard } from "@/components/app/recent-activity";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function PercentBar({ value }: { value: number }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-2 w-full overflow-hidden rounded bg-neutral-200"
    >
      <div className="h-full bg-neutral-900" style={{ width: `${value}%` }} />
    </div>
  );
}

export const metadata = { title: "Student dashboard — Digital BE Log Book" };

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft — not submitted",
  SUBMITTED: "Submitted — awaiting HOD approval",
  ACTIVE: "Active",
  READY_FOR_PDF: "Ready for PDF",
  PDF_ALLOWED: "PDF allowed",
  PDF_GENERATED: "PDF generated",
};

/**
 * Student dashboard (F15): section stepper with completion percent, pending
 * items, the final-exam eligibility warning and the PDF status panel.
 */
export default async function StudentDashboardPage() {
  const user = await requireRole("STUDENT");

  const membership = await prisma.groupMember.findFirst({
    where: { userId: user.id },
    include: {
      group: {
        include: {
          guide: { select: { name: true } },
          _count: { select: { members: true, competitions: true } },
        },
      },
    },
  });

  const [recent, completion] = await Promise.all([
    listRecentActivity({ id: user.id, role: user.role }, 8),
    membership ? getGroupCompletion(membership.groupId) : Promise.resolve(null),
  ]);

  const eligible = (membership?.group._count.competitions ?? 0) > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <Card>
        <CardHeader>
          <CardTitle>Welcome, {user.name}</CardTitle>
          {membership ? (
            <CardDescription>
              {membership.group.groupNo ? `Group ${membership.group.groupNo}` : "Group"} ·{" "}
              {membership.group._count.members} member(s) · Guide:{" "}
              {membership.group.guide?.name ?? "not assigned yet"}
            </CardDescription>
          ) : (
            <CardDescription>You are not in a group yet.</CardDescription>
          )}
        </CardHeader>
        {membership ? (
          <CardContent className="space-y-2">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Badge>{STATUS_LABEL[membership.group.status] ?? membership.group.status}</Badge>
              {completion ? (
                <span className="text-muted-foreground">{completion.percent}% complete</span>
              ) : null}
            </div>
            {completion ? <PercentBar value={completion.percent} /> : null}
            {membership.group.projectTitle ? (
              <p className="text-sm text-muted-foreground">{membership.group.projectTitle}</p>
            ) : null}
          </CardContent>
        ) : null}
      </Card>

      {!membership ? (
        <Card>
          <CardContent className="pt-6">
            <Button asChild size="sm">
              <Link href="/student/group">Create or join a group</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {membership && !eligible ? (
        <Alert variant="destructive">
          <AlertTitle>Not eligible for the final exam</AlertTitle>
          <AlertDescription>
            Your group has no competition entries yet.{" "}
            <Link className="underline" href="/student/competitions">
              Add one
            </Link>{" "}
            to restore eligibility.
          </AlertDescription>
        </Alert>
      ) : null}

      {membership && completion ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Section stepper</CardTitle>
            <CardDescription>
              {completion.complete
                ? "Every mandatory section is complete."
                : `${completion.missing.length} section(s) still need work.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {completion.sections.map((section) => (
                <li key={section.key} className="flex items-center gap-3 py-2 text-sm">
                  <span
                    aria-label={section.complete ? "complete" : "incomplete"}
                    className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                      section.complete ? "bg-green-700 text-white" : "border text-muted-foreground"
                    }`}
                  >
                    {section.complete ? "✓" : "○"}
                  </span>
                  <Link href={section.href} className="flex-1 hover:underline">
                    {section.label}
                  </Link>
                  <span className="w-12 text-right tabular-nums text-muted-foreground">
                    {section.percent}%
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {membership && completion && !completion.complete ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending items</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {completion.sections
              .filter((section) => !section.complete)
              .map((section) => (
                <div key={section.key} className="flex items-center gap-3 text-sm">
                  <span className="flex-1">
                    {section.label} — {section.percent}% done
                  </span>
                  <Button asChild size="sm" variant="outline">
                    <Link href={section.href}>Open</Link>
                  </Button>
                </div>
              ))}
          </CardContent>
        </Card>
      ) : null}

      {membership ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Final PDF</CardTitle>
            <CardDescription>
              {membership.group.status === "PDF_GENERATED"
                ? "The final PDF has been generated."
                : membership.group.pdfPermission
                  ? "The HOD has allowed PDF generation."
                  : "The HOD allows PDF generation once every section is complete."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge variant={completion?.complete ? "default" : "secondary"}>
                {completion?.complete ? "All sections complete" : "Sections incomplete"}
              </Badge>
              <Badge variant={membership.group.pdfPermission ? "default" : "secondary"}>
                {membership.group.pdfPermission ? "PDF allowed" : "PDF not allowed"}
              </Badge>
            </div>
            {completion && !completion.complete ? (
              <p className="text-muted-foreground">Missing: {completion.missing.join(", ")}</p>
            ) : null}
            <Button asChild size="sm" variant="outline">
              <Link href="/student/pdf">Open PDF status & download</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <RecentActivityCard initial={recent} limit={8} />
    </div>
  );
}
