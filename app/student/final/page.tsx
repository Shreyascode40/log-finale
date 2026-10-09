import { redirect } from "next/navigation";
import { EvalSheetScreen } from "@/components/evaluation/eval-sheet";
import { FINAL_T2_COMPONENTS, FINAL_T2_TOTAL } from "@/lib/constants";
import { requireRole } from "@/lib/permissions";
import {
  approveFinalSheetsAction,
  saveFinalSheetsAction,
  submitFinalSheetsAction,
  unlockFinalSheetsAction,
} from "@/lib/actions/final";
import { finalOpen, getFinalSheet, getStudentFinalGroupId } from "@/lib/services/final";

export const metadata = { title: "Final Evaluation Term-II — Digital BE Log Book" };

/** Student read-only view of the Term-II final table (F13). */
export default async function StudentFinalPage({
  searchParams,
}: {
  searchParams?: { print?: string };
}) {
  const user = await requireRole("STUDENT");
  const groupId = await getStudentFinalGroupId(user.id);
  if (!groupId) redirect("/student/group");

  const sheet = await getFinalSheet(groupId);

  return (
    <EvalSheetScreen
      groupId={sheet.group.id}
      groupNo={sheet.group.groupNo}
      title="Final Evaluation of Project (Term-II)"
      subtitle="Total 100"
      components={FINAL_T2_COMPONENTS}
      totalMax={FINAL_T2_TOTAL}
      rows={sheet.rows}
      submittedByName={sheet.submittedSign.name}
      submittedAt={sheet.submittedSign.at}
      actions={{
        save: saveFinalSheetsAction,
        submit: submitFinalSheetsAction,
        approve: approveFinalSheetsAction,
        unlock: unlockFinalSheetsAction,
      }}
      mode="student"
      editable={finalOpen(sheet.group.status)}
      print={searchParams?.print === "1"}
      printHref="/student/final?print=1"
    />
  );
}
