import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ExaminerSheetScreen } from "@/components/examiner/examiner-sheet";
import { requireRole } from "@/lib/permissions";
import { examinerOpen, getExaminerSheet } from "@/lib/services/examiner";

export const metadata = { title: "External Examiner Feedback Term-I — Digital BE Log Book" };

/**
 * Guide recording view of a group's examiner feedback (F11). Only the guide
 * assigned to THIS group may open (and record) it.
 */
export default async function GuideGroupExaminerPage({
  params,
  searchParams,
}: {
  params: { groupId: string };
  searchParams?: { print?: string };
}) {
  const user = await requireRole("GUIDE");
  const sheet = await getExaminerSheet(params.groupId, "TERM_I").catch(() => null);
  if (!sheet) notFound();
  if (sheet.group.guideId !== user.id) redirect("/guide/examiner");

  const print = searchParams?.print === "1";

  return (
    <div className="min-h-screen bg-neutral-100">
      {print ? null : (
        <div className="print-hide border-b bg-white px-4 py-2 text-sm">
          <Link className="text-muted-foreground hover:text-neutral-900" href="/guide/examiner">
            ‹ Back to examiner feedback
          </Link>
        </div>
      )}
      <ExaminerSheetScreen
        groupId={sheet.group.id}
        groupNo={sheet.group.groupNo}
        term="TERM_I"
        termLabel="Term-I"
        projectTitle={sheet.projectTitle}
        date={sheet.date}
        answers={sheet.answers}
        remarks={sheet.remarks}
        externalName={sheet.externalName}
        internalName={sheet.internalName}
        signedAt={sheet.signedAt}
        mode="guide"
        editable={examinerOpen(sheet.group.status)}
        print={print}
        printHref={`/guide/examiner/${params.groupId}?print=1`}
      />
    </div>
  );
}
