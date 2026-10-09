import Link from "next/link";
import { redirect } from "next/navigation";
import { ReviewSheetScreen } from "@/components/reviews/review-sheet";
import { requireRole } from "@/lib/permissions";
import { getReviewSheet, getStudentReviewGroupId, reviewsOpen } from "@/lib/services/review";
import { ALL_REVIEW_TYPES } from "@/lib/validation/review";

export const metadata = { title: "Review — Digital BE Log Book" };

/** Student read-only view of one Term-I review sheet (F10). */
export default async function StudentReviewPage({
  params,
  searchParams,
}: {
  params: { reviewType: string };
  searchParams?: { print?: string };
}) {
  const user = await requireRole("STUDENT");
  if (!(ALL_REVIEW_TYPES as readonly string[]).includes(params.reviewType)) {
    redirect("/student/reviews");
  }

  const groupId = await getStudentReviewGroupId(user.id);
  if (!groupId) redirect("/student/group");

  const sheet = await getReviewSheet(groupId, params.reviewType);

  return (
    <ReviewSheetScreen
      groupId={sheet.group.id}
      groupNo={sheet.group.groupNo}
      guideName={sheet.guideName}
      reviewType={params.reviewType}
      title={sheet.template.title}
      formStatus={sheet.form.status}
      remarkAndSuggestions={sheet.form.remarkAndSuggestions}
      submittedByName={sheet.form.submittedByName}
      submittedAt={sheet.form.submittedAt}
      approvedByName={sheet.form.approvedByName}
      approvedAt={sheet.form.approvedAt}
      unlockReason={sheet.form.unlockReason}
      scores={sheet.scores}
      hasDateColumn={sheet.template.hasDateColumn}
      mode="student"
      editable={reviewsOpen(sheet.group.status)}
      print={searchParams?.print === "1"}
      printHref={`/student/reviews/${params.reviewType}?print=1`}
    />
  );
}
