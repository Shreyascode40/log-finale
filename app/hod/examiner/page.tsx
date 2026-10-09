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
import { requireRole } from "@/lib/permissions";
import { listExaminerQueue } from "@/lib/services/examiner";

export const metadata = { title: "Examiner Feedback — Digital BE Log Book" };

/** HOD index of recorded examiner feedback (F11). Read-only. */
export default async function HodExaminerPage() {
  await requireRole("HOD");
  const groups = await listExaminerQueue();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>External Examiner Feedback Term-I</CardTitle>
          <CardDescription>
            Read-only. The assigned guide transcribes the external examiner&rsquo;s ratings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No feedback recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Group</TableHead>
                  <TableHead>Guide</TableHead>
                  <TableHead>Feedback</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell className="font-medium">
                      {group.groupNo ? `Group ${group.groupNo}` : "Group"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {group.guide?.name ?? "Not assigned"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">Saved</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/hod/examiner/${group.id}/TERM_I`}>Review</Link>
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
