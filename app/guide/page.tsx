import Link from "next/link";
import { AppHeader } from "@/components/app/app-header";
import { RecentActivityCard } from "@/components/app/recent-activity";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/permissions";
import { listRecentActivity } from "@/lib/services/activity";
import { getGuideOverview } from "@/lib/completion/index";

export const metadata = { title: "Guide dashboard — Digital BE Log Book" };

/**
 * Guide dashboard (F15): only assigned groups, each with its completion
 * percent and everything awaiting the guide (verifications, scoring,
 * reviews and mark sheets).
 */
export default async function GuideDashboardPage() {
  const user = await requireRole("GUIDE");
  const [overview, recent] = await Promise.all([
    getGuideOverview(user.id),
    listRecentActivity({ id: user.id, role: user.role }, 8),
  ]);

  return (
    <div className="min-h-screen bg-neutral-100">
      <AppHeader name={user.name} role="Guide / Reviewer" homeHref="/guide" />
      <main className="mx-auto max-w-4xl space-y-4 px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Welcome, {user.name}</CardTitle>
            <CardDescription>
              {overview.length === 0
                ? "No groups are assigned to you yet. The HOD assigns one guide per group."
                : `${overview.length} assigned group(s).`}
            </CardDescription>
          </CardHeader>
        </Card>

        {overview.map((group) => {
          const pending: { label: string; href: string }[] = [];
          if (group.unverifiedEntries > 0) {
            pending.push({
              label: `${group.unverifiedEntries} activity row(s) to verify`,
              href: `/guide/activity/${group.groupId}/june`,
            });
          }
          if (group.topicsToScore > 0) {
            pending.push({
              label: `${group.topicsToScore} topic(s) to score`,
              href: `/guide/topics/${group.groupId}`,
            });
          }
          if (group.draftReviews > 0) {
            pending.push({
              label: `${group.draftReviews} review draft(s) to fill`,
              href: `/guide/reviews/${group.groupId}/REVIEW_I`,
            });
          }
          if (group.submittedReviews > 0) {
            pending.push({
              label: `${group.submittedReviews} submitted review(s) to approve`,
              href: `/guide/reviews/${group.groupId}/REVIEW_I`,
            });
          }
          if (group.openMockRows > 0) {
            pending.push({
              label: `Mock table: ${group.openMockRows} open row(s)`,
              href: `/guide/mock/${group.groupId}`,
            });
          }
          if (group.openFinalRows > 0) {
            pending.push({
              label: `Final table: ${group.openFinalRows} open row(s)`,
              href: `/guide/final/${group.groupId}`,
            });
          }
          if (group.unsignedMeetings > 0) {
            pending.push({
              label: `${group.unsignedMeetings} meeting(s) to countersign`,
              href: `/guide/sponsored/${group.groupId}`,
            });
          }
          return (
            <Card key={group.groupId}>
              <CardHeader>
                <CardTitle className="text-base">
                  {group.groupNo ? `Group ${group.groupNo}` : "Group"}
                  {group.projectTitle ? (
                    <span className="font-normal text-muted-foreground"> · {group.projectTitle}</span>
                  ) : null}
                </CardTitle>
                <CardDescription>
                  {group.status} · {group.percent}% complete
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {pending.length === 0 ? (
                  <p className="text-muted-foreground">All caught up — nothing awaiting you.</p>
                ) : (
                  <ul className="space-y-1">
                    {pending.map((item) => (
                      <li key={item.label}>
                        <Link href={item.href} className="text-blue-700 hover:underline">
                          {item.label} →
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Badge variant="secondary">{group.percent}%</Badge>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/guide/schedule">Schedule</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/guide/topics/${group.groupId}`}>Topics</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/guide/reviews/${group.groupId}/REVIEW_I`}>Reviews</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        <RecentActivityCard initial={recent} limit={8} />
      </main>
    </div>
  );
}
