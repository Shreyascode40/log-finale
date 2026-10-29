import Link from "next/link";
import { notFound } from "next/navigation";
import { ReviewSheetScreen } from "@/components/reviews/review-sheet";
import { requireRole } from "@/lib/permissions";
import { getReviewSheet, reviewsOpen } from "@/lib/services/review";
import { ALL_REVIEW_TYPES, REVIEW_TABS } from "@/lib/validation/review";

export const metadata = { title: "Review — Digital BE Log Book" };

/** HOD approve/unlock view of a group's review sheet (F10). */
export default async function HodGroupReviewPage({
  params,
  searchParams,
}: {
  params: { groupId: string; reviewType: string };
  searchParams?: { print?: string };
}) {
  await requireRole("HOD");
  if (!(ALL_REVIEW_TYPES as readonly string[]).includes(params.reviewType)) notFound();

  const sheet = await getReviewSheet(params.groupId, params.reviewType).catch(() => null);
  if (!sheet) notFound();

  const print = searchParams?.print === "1";
  const tabs = REVIEW_TABS[sheet.template.term === "TERM_II" ? "TERM_II" : "TERM_I"];

  return (
    <div className="space-y-3">
      {print ? null : (
        <>
          <Link
            className="print-hide text-sm text-muted-foreground hover:text-neutral-900"
            href="/hod/reviews"
          >
            ‹ Back to review approvals
          </Link>
          <nav aria-label="Reviews" className="print-hide border-b bg-white">
            <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
              {tabs.map((link) => {
                const active = link.reviewType === params.reviewType;
                return (
                  <Link
                    key={link.reviewType}
                    href={`/hod/reviews/${params.groupId}/${link.reviewType}`}
                    aria-current={active ? "page" : undefined}
                    className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${
                      active
                        ? "border-neutral-900 font-medium text-neutral-900"
                        : "border-transparent text-muted-foreground hover:text-neutral-900"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        </>
      )}
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
        mode="hod"
        editable={reviewsOpen(sheet.group.status)}
        print={print}
        printHref={`/hod/reviews/${params.groupId}/${params.reviewType}?print=1`}
      />
    </div>
  );
}
