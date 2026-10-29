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
import { listRecordsQueue } from "@/lib/services/records";

export const metadata = { title: "Group records — Digital BE Log Book" };

/** HOD index of group records (F12). Read-only; students file the records. */
export default async function HodRecordsPage() {
  await requireRole("HOD");
  const groups = await listRecordsQueue();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Competitions, papers, checklists, RTM, cost, notes</CardTitle>
          <CardDescription>
            Read-only. Students of each group file these records.
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
                  <TableHead>Records</TableHead>
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
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="secondary">{group._count.competitions} competitions</Badge>
                        <Badge variant="secondary">{group._count.papers} papers</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/hod/records/${group.id}`}>Review</Link>
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
