import Link from "next/link";
import { AppHeader } from "@/components/app/app-header";
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
import { TOPIC_STATUS_LABELS } from "@/lib/constants";
import { requireRole } from "@/lib/permissions";
import { listGuideTopicGroups, topicsOpen } from "@/lib/services/topic";

export const metadata = { title: "Topic finalization — Digital BE Log Book" };

/** Guide index of assigned groups whose project topics need scoring (F8). */
export default async function GuideTopicsPage() {
  const user = await requireRole("GUIDE");
  const groups = await listGuideTopicGroups(user.id);

  return (
    <div className="min-h-screen bg-neutral-100">
      <AppHeader name={user.name} role="Guide / Reviewer" homeHref="/guide" />
      <main className="mx-auto max-w-4xl space-y-4 px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Project topic scoring</CardTitle>
            <CardDescription>
              Score Significance, Innovativeness, Scope and Feasibility (0–10) and record a
              Yes/No recommendation. The HOD gives the final decision.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No groups are assigned to you yet. The HOD assigns one guide per group.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Group</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Topic status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map((group) => (
                    <TableRow key={group.id}>
                      <TableCell className="font-medium">
                        {group.groupNo ? `Group ${group.groupNo}` : "Group"}
                      </TableCell>
                      <TableCell className="max-w-[16rem] truncate text-muted-foreground">
                        {group.projectTitle || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {group.topics.length === 0 ? (
                            <span className="text-xs text-muted-foreground">
                              Not submitted yet
                            </span>
                          ) : (
                            group.topics.map((topic) => (
                              <Badge key={topic.id} variant="secondary">
                                T{topic.topicNo}: {TOPIC_STATUS_LABELS[topic.status] ?? topic.status}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/guide/topics/${group.id}`}>
                            {topicsOpen(group.status) ? "Open & score" : "View"}
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Button asChild variant="outline" size="sm">
          <Link href="/guide">Back to dashboard</Link>
        </Button>
      </main>
    </div>
  );
}
