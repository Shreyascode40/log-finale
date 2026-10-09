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
import { examinerOpen, listGuideExaminerGroups } from "@/lib/services/examiner";

export const metadata = { title: "Examiner Feedback — Digital BE Log Book" };

/** Guide index of assigned groups for examiner feedback (F11). */
export default async function GuideExaminerPage() {
  const user = await requireRole("GUIDE");
  const groups = await listGuideExaminerGroups(user.id);

  return (
    <div className="min-h-screen bg-neutral-100">
      <AppHeader name={user.name} role="Guide / Reviewer" homeHref="/guide" />
      <main className="mx-auto max-w-4xl space-y-4 px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>External Examiner Feedback Term-I</CardTitle>
            <CardDescription>
              Transcribe the external examiner&rsquo;s Excellent / Good / Satisfactory ratings.
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
                      <TableCell className="max-w-[16rem] truncate text-muted-foreground">
                        {group.projectTitle || "—"}
                      </TableCell>
                      <TableCell>
                        {group.examinerFeedbacks.length === 0 ? (
                          <span className="text-xs text-muted-foreground">Not recorded</span>
                        ) : (
                          <Badge variant="secondary">Saved</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/guide/examiner/${group.id}/TERM_I`}>
                            {examinerOpen(group.status) ? "Open & record" : "View"}
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
