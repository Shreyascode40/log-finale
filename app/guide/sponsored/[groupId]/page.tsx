import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/app/app-header";
import { FeedbackSheet } from "@/components/sponsored/feedback-sheet";
import { MeetingSheet } from "@/components/sponsored/meeting-sheet";
import { requireRole } from "@/lib/permissions";
import { getSponsoredSheet } from "@/lib/services/sponsored";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Sponsored project — Digital BE Log Book" };

/**
 * Guide countersign view of a group's sponsored sheets (F14). Only the guide
 * assigned to THIS group may open it; the service re-checks on every sign.
 */
export default async function GuideGroupSponsoredPage({
  params,
  searchParams,
}: {
  params: { groupId: string };
  searchParams?: { print?: string };
}) {
  const user = await requireRole("GUIDE");
  const sheet = await getSponsoredSheet(params.groupId).catch(() => null);
  if (!sheet) notFound();
  if (sheet.group.guideId !== user.id) redirect("/guide/sponsored");

  const print = searchParams?.print === "1";

  if (!sheet.group.isSponsored) {
    return (
      <div className="min-h-screen bg-neutral-100">
        <AppHeader name={user.name} role="Guide / Reviewer" homeHref="/guide" />
        <main className="mx-auto max-w-3xl px-4 py-8">
          <Card>
            <CardHeader>
              <CardTitle>Not a sponsored project</CardTitle>
              <CardDescription>
                This group is not flagged as sponsored, so there are no meeting or
                feedback sheets for it.
              </CardDescription>
            </CardHeader>
          </Card>
        </main>
      </div>
    );
  }

  const editable = sheet.group.status !== "PDF_GENERATED";

  return (
    <div className="min-h-screen bg-neutral-100">
      {print ? null : (
        <div className="print-hide border-b bg-white px-4 py-2 text-sm">
          <Link className="text-muted-foreground hover:text-neutral-900" href="/guide/sponsored">
            ‹ Back to sponsored meetings
          </Link>
        </div>
      )}
      {sheet.semesters.map((semester) => (
        <MeetingSheet
          key={semester.semester}
          semester={semester.semester}
          title={semester.title}
          rows={semester.rows}
          mode="guide"
          editable={editable}
          print={print}
          printHref={`/guide/sponsored/${params.groupId}?print=1`}
        />
      ))}
      <FeedbackSheet
        company={sheet.feedback.company}
        ratings={sheet.feedback.ratings}
        sealUrl={sheet.feedback.sealUrl}
        signedAt={sheet.feedback.signedAt}
        mode="guide"
        editable={false}
        print={print}
        printHref={`/guide/sponsored/${params.groupId}?print=1`}
      />
    </div>
  );
}
