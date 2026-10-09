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
import { chartsOpen, listGuideChartGroups } from "@/lib/services/activity-chart";

export const metadata = { title: "Activity verification — Digital BE Log Book" };

function progress(entries: { status: string }[]): { verified: number; confirmed: number; total: number } {
  return {
    verified: entries.filter((entry) => entry.status === "GUIDE_VERIFIED").length,
    confirmed: entries.filter((entry) => entry.status === "STUDENT_CONFIRMED").length,
    total: entries.length,
  };
}

/** Guide index of assigned groups whose activity rows need verification (F9). */
export default async function GuideActivityPage() {
  const user = await requireRole("GUIDE");
  const groups = await listGuideChartGroups(user.id);

  return (
    <div className="min-h-screen bg-neutral-100">
      <AppHeader name={user.name} role="Guide / Reviewer" homeHref="/guide" />
      <main className="mx-auto max-w-4xl space-y-4 px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Activity verification</CardTitle>
            <CardDescription>
              Confirm each row the students have completed, then verify it. Editing a
              verified row later asks you to verify it again.
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
                    <TableHead>Progress</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map((group) => {
                    const { verified, confirmed, total } = progress(group.activityEntries);
                    return (
                      <TableRow key={group.id}>
                        <TableCell className="font-medium">
                          {group.groupNo ? `Group ${group.groupNo}` : "Group"}
                        </TableCell>
                        <TableCell className="max-w-[16rem] truncate text-muted-foreground">
                          {group.projectTitle || "—"}
                        </TableCell>
                        <TableCell>
                          {total === 0 ? (
                            <span className="text-xs text-muted-foreground">
                              No rows opened yet
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              <Badge variant="secondary">
                                {verified}/{total} verified
                              </Badge>
                              {confirmed > 0 ? (
                                <Badge variant="outline">{confirmed} awaiting you</Badge>
                              ) : null}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/guide/activity/${group.id}/june`}>
                              {chartsOpen(group.status) ? "Open & verify" : "View"}
                            </Link>
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
