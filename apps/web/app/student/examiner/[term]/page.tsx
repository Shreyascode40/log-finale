import { notFound, redirect } from "next/navigation";
import { ExaminerSheetScreen } from "@/components/examiner/examiner-sheet";
import { requireRole } from "@/lib/permissions";
import { examinerOpen, getExaminerSheet, getStudentExaminerGroupId } from "@/lib/services/examiner";
import { examinerTermSchema } from "@/lib/validation/examiner";

export const metadata = { title: "External Examiner Feedback — Digital BE Log Book" };

const TERM_LABELS = { TERM_I: "Term-I", TERM_II: "Term-II" } as const;

/** Student read-only view of an examiner feedback sheet (F11/F13). */
export default async function StudentExaminerTermPage({
  params,
  searchParams,
}: {
  params: { term: string };
  searchParams?: { print?: string };
}) {
  const user = await requireRole("STUDENT");
  const parsed = examinerTermSchema.safeParse(params.term);
  if (!parsed.success) notFound();

  const groupId = await getStudentExaminerGroupId(user.id);
  if (!groupId) redirect("/student/group");

  const sheet = await getExaminerSheet(groupId, parsed.data);

  return (
    <ExaminerSheetScreen
      groupId={sheet.group.id}
      groupNo={sheet.group.groupNo}
      term={parsed.data}
      termLabel={TERM_LABELS[parsed.data]}
      projectTitle={sheet.projectTitle}
      date={sheet.date}
      answers={sheet.answers}
      remarks={sheet.remarks}
      externalName={sheet.externalName}
      internalName={sheet.internalName}
      signedAt={sheet.signedAt}
      mode="student"
      editable={examinerOpen(sheet.group.status)}
      print={searchParams?.print === "1"}
      printHref={`/student/examiner/${parsed.data}?print=1`}
    />
  );
}
