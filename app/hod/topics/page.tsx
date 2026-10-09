import Link from "next/link";
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
import { listTopicQueue } from "@/lib/services/topic";

export const metadata = { title: "Topic approvals — Digital BE Log Book" };

/** HOD approval queue for project topics (F8). */
export default async function HodTopicsPage() {
  await requireRole("HOD");
  const groups = await listTopicQueue();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Topic finalization</CardTitle>
          <CardDescription>
            Approve or reject each group&rsquo;s project topic. The guide must score a topic before
            it reaches this queue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No group has submitted a topic yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Group</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Guide</TableHead>
                  <TableHead>Topics</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell className="font-medium">
                      {group.groupNo ? `Group ${group.groupNo}` : "Group"}
                    </TableCell>
                    <TableCell className="max-w-[14rem] truncate text-muted-foreground">
                      {group.projectTitle || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {group.guide?.name ?? "Not assigned"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {group.topics.map((topic) => (
                          <Badge key={topic.id} variant="secondary">
                            T{topic.topicNo}: {TOPIC_STATUS_LABELS[topic.status] ?? topic.status}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/hod/topics/${group.id}`}>Review</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
