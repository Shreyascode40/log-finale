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
import { listGuideReviewGroups, reviewsOpen } from "@/lib/services/review";

export const metadata = { title: "Reviews — Digital BE Log Book" };

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
};

/** Guide index of assigned groups with their Term-I review forms (F10). */
export default async function GuideReviewsPage() {
  const user = await requireRole("GUIDE");
  const groups = await listGuideReviewGroups(user.id);

  return (
    <div className="min-h-screen bg-neutral-100">
      <AppHeader name={user.name} role="Guide / Reviewer" homeHref="/guide" />
      <main className="mx-auto max-w-4xl space-y-4 px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Reviews and marks</CardTitle>
            <CardDescription>
              Fill remarks and grades, submit to sign every question, then approve to lock.
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
                    <TableHead>Reviews</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map((group) => (
                    <TableRow key={group.id}>
                      <TableCell className="font-medium">
                        {group.groupNo ? `Group ${group.groupNo}` : "Group"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {group.reviewForms.length === 0 ? (
                            <span className="text-xs text-muted-foreground">Not started</span>
                          ) : (
                            group.reviewForms.map((form) => (
                              <Badge key={form.id} variant="secondary">
                                {form.template.title.split("(")[0]?.trim()}:{" "}
                                {STATUS_LABEL[form.status] ?? form.status}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/guide/reviews/${group.id}/REVIEW_I`}>
                            {reviewsOpen(group.status) ? "Open & mark" : "View"}
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
