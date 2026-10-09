import Link from "next/link";
import { notFound } from "next/navigation";
import { ExaminerSheetScreen } from "@/components/examiner/examiner-sheet";
import { requireRole } from "@/lib/permissions";
import { examinerOpen, getExaminerSheet } from "@/lib/services/examiner";

export const metadata = { title: "External Examiner Feedback Term-I — Digital BE Log Book" };

/** HOD read-only view of a group's examiner feedback (F11). */
export default async function HodGroupExaminerPage({
  params,
  searchParams,
}: {
  params: { groupId: string };
  searchParams?: { print?: string };
}) {
  await requireRole("HOD");
  const sheet = await getExaminerSheet(params.groupId, "TERM_I").catch(() => null);
  if (!sheet) notFound();

  const print = searchParams?.print === "1";

  return (
    <div className="space-y-3">
      {print ? null : (
        <Link
          className="print-hide text-sm text-muted-foreground hover:text-neutral-900"
          href="/hod/examiner"
        >
          ‹ Back to examiner feedback
        </Link>
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
        mode="hod"
        editable={examinerOpen(sheet.group.status)}
        print={print}
        printHref={`/hod/examiner/${params.groupId}?print=1`}
      />
    </div>
  );
}
