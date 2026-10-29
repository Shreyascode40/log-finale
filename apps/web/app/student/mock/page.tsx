import { redirect } from "next/navigation";
import { EvalSheetScreen } from "@/components/evaluation/eval-sheet";
import { MOCK_T1_COMPONENTS, MOCK_T1_TOTAL } from "@/lib/constants";
import { requireRole } from "@/lib/permissions";
import {
  approveMockSheetsAction,
  saveMockSheetsAction,
  submitMockSheetsAction,
  unlockMockSheetsAction,
} from "@/lib/actions/mock";
import { getMockSheet, getStudentMockGroupId, mockOpen } from "@/lib/services/mock";

export const metadata = { title: "Mock Evaluation Term-I — Digital BE Log Book" };

/** Student read-only view of the Term-I mock table (F11). */
export default async function StudentMockPage({
  searchParams,
}: {
  searchParams?: { print?: string };
}) {
  const user = await requireRole("STUDENT");
  const groupId = await getStudentMockGroupId(user.id);
  if (!groupId) redirect("/student/group");

  const sheet = await getMockSheet(groupId);

  return (
    <EvalSheetScreen
      groupId={sheet.group.id}
      groupNo={sheet.group.groupNo}
      title="Mock Evaluation Term-I (Final Review)"
      subtitle="Total 50 · Refer Rubrics for Details"
      components={MOCK_T1_COMPONENTS}
      totalMax={MOCK_T1_TOTAL}
      rows={sheet.rows}
      submittedByName={sheet.submittedSign.name}
      submittedAt={sheet.submittedSign.at}
      actions={{
        save: saveMockSheetsAction,
        submit: submitMockSheetsAction,
        approve: approveMockSheetsAction,
        unlock: unlockMockSheetsAction,
      }}
      mode="student"
      editable={mockOpen(sheet.group.status)}
      print={searchParams?.print === "1"}
      printHref="/student/mock?print=1"
    />
  );
}
