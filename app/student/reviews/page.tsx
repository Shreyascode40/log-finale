import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/permissions";
import { getStudentReviewGroupId, listGroupReviewStatuses } from "@/lib/services/review";

export const metadata = { title: "Reviews — Digital BE Log Book" };

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
};

/** Student index of review sheets (F10). Read-only; the guide writes marks. */
export default async function StudentReviewsPage() {
  const user = await requireRole("STUDENT");
  const groupId = await getStudentReviewGroupId(user.id);
  if (!groupId) redirect("/student/group");

  const reviews = await listGroupReviewStatuses(groupId);

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <Card>
        <CardHeader>
          <CardTitle>Reviews and marks</CardTitle>
          <CardDescription>
            Read-only for students. Only the assigned guide enters remarks and grades.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {reviews.map((review) => (
            <div
              key={review.reviewType}
              className="flex flex-wrap items-center gap-3 rounded border px-3 py-2 text-sm"
            >
              <span className="flex-1 font-medium">{review.title}</span>
              <Badge variant="secondary">{STATUS_LABEL[review.status] ?? review.status}</Badge>
              <Button asChild size="sm" variant="outline">
                <Link href={`/student/reviews/${review.reviewType}`}>Open</Link>
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
