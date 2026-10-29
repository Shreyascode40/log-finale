import Link from "next/link";
import { notFound } from "next/navigation";
import { FeedbackSheet } from "@/components/sponsored/feedback-sheet";
import { MeetingSheet } from "@/components/sponsored/meeting-sheet";
import { requireRole } from "@/lib/permissions";
import { getSponsoredSheet } from "@/lib/services/sponsored";

export const metadata = { title: "Sponsored project — Digital BE Log Book" };

/** HOD read-only view of a group's sponsored sheets (F14). */
export default async function HodGroupSponsoredPage({
  params,
  searchParams,
}: {
  params: { groupId: string };
  searchParams?: { print?: string };
}) {
  await requireRole("HOD");
  const sheet = await getSponsoredSheet(params.groupId).catch(() => null);
  if (!sheet) notFound();

  const print = searchParams?.print === "1";
  const printHref = `/hod/sponsored/${params.groupId}?print=1`;

  return (
    <div className="space-y-3">
      {print ? null : (
        <Link
          className="print-hide text-sm text-muted-foreground hover:text-neutral-900"
          href="/hod/sponsored"
        >
          ‹ Back to sponsored projects
        </Link>
      )}
      {sheet.semesters.map((semester) => (
        <MeetingSheet
          key={semester.semester}
          semester={semester.semester}
          title={semester.title}
          rows={semester.rows}
          mode="hod"
          editable={false}
          print={print}
          printHref={printHref}
        />
      ))}
      <FeedbackSheet
        company={sheet.feedback.company}
        ratings={sheet.feedback.ratings}
        sealUrl={sheet.feedback.sealUrl}
        signedAt={sheet.feedback.signedAt}
        mode="hod"
        editable={false}
        print={print}
        printHref={printHref}
      />
    </div>
  );
}
