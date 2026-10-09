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
import { requireRole } from "@/lib/permissions";
import { listGuideSponsoredGroups } from "@/lib/services/sponsored";

export const metadata = { title: "Sponsored meetings — Digital BE Log Book" };

/** Guide index of assigned groups for meeting countersigns (F14). */
export default async function GuideSponsoredPage() {
  const user = await requireRole("GUIDE");
  const groups = await listGuideSponsoredGroups(user.id);

  return (
    <div className="min-h-screen bg-neutral-100">
      <AppHeader name={user.name} role="Guide / Reviewer" homeHref="/guide" />
      <main className="mx-auto max-w-4xl space-y-4 px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Sponsored meeting log</CardTitle>
            <CardDescription>
              Countersign the meeting rows your students have signed.
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
                    <TableHead>Sheets</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map((group) => {
                    const pending = group.sponsoredMeetings.filter(
                      (meeting) => !meeting.guideSignedAt,
                    ).length;
                    return (
                      <TableRow key={group.id}>
                        <TableCell className="font-medium">
                          {group.groupNo ? `Group ${group.groupNo}` : "Group"}
                        </TableCell>
                        <TableCell className="max-w-[16rem] truncate text-muted-foreground">
                          {group.projectTitle || "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {group.isSponsored ? (
                              <Badge variant="secondary">Sponsored</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">Not sponsored</span>
                            )}
                            {pending > 0 ? (
                              <Badge variant="outline">{pending} awaiting you</Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/guide/sponsored/${group.id}`}>Open</Link>
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

        <Button asChild variant="outline" size="sm">
          <Link href="/guide">Back to dashboard</Link>
        </Button>
      </main>
    </div>
  );
}
