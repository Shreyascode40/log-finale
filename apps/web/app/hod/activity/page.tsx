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
import { listChartQueue } from "@/lib/services/activity-chart";

export const metadata = { title: "Activity charts — Digital BE Log Book" };

function progress(entries: { status: string }[]): { verified: number; total: number } {
  return {
    verified: entries.filter((entry) => entry.status === "GUIDE_VERIFIED").length,
    total: entries.length,
  };
}

/** HOD read-only index of every group's activity charts (F9). */
export default async function HodActivityPage() {
  await requireRole("HOD");
  const groups = await listChartQueue();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Activity charts</CardTitle>
          <CardDescription>
            Every group&rsquo;s month-by-month progress. Students confirm rows, the
            assigned guide verifies them.
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
                  <TableHead>Project</TableHead>
                  <TableHead>Guide</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((group) => {
                  const { verified, total } = progress(group.activityEntries);
                  return (
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
                        {total === 0 ? (
                          <span className="text-xs text-muted-foreground">Not started</span>
                        ) : (
                          <Badge variant="secondary">
                            {verified}/{total} verified
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/hod/activity/${group.id}/june`}>Review</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
