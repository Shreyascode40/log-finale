import Link from "next/link";
import { requireRole } from "@/lib/permissions";
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
import { listMockQueue } from "@/lib/services/mock";

export const metadata = { title: "Mock Evaluation — Digital BE Log Book" };

/** HOD queue of mock tables (F11). */
export default async function HodMockPage() {
  await requireRole("HOD");
  const groups = await listMockQueue();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Mock Evaluation Term-I (50)</CardTitle>
          <CardDescription>
            Approve submitted tables to lock them, or unlock approved ones with a written
            reason. Only the HOD can unlock.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No group has started marking yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Group</TableHead>
                  <TableHead>Guide</TableHead>
                  <TableHead>Rows</TableHead>
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
                        {group.markSheets.map((sheet) => (
                          <Badge key={sheet.id} variant="secondary">
                            {sheet.status}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/hod/mock/${group.id}`}>Review</Link>
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
