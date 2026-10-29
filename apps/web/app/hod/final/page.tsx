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
import { listFinalQueue } from "@/lib/services/final";

export const metadata = { title: "Final Evaluation — Digital BE Log Book" };

/** HOD queue of final tables (F13). */
export default async function HodFinalPage() {
  await requireRole("HOD");
  const groups = await listFinalQueue();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Final Evaluation Term-II (100)</CardTitle>
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
                        <Link href={`/hod/final/${group.id}`}>Review</Link>
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
