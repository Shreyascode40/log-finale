import Link from "next/link";
import { notFound } from "next/navigation";
import { EvalSheetScreen } from "@/components/evaluation/eval-sheet";
import { MOCK_T1_COMPONENTS, MOCK_T1_TOTAL } from "@/lib/constants";
import { requireRole } from "@/lib/permissions";
import {
  approveMockSheetsAction,
  saveMockSheetsAction,
  submitMockSheetsAction,
  unlockMockSheetsAction,
} from "@/lib/actions/mock";
import { getMockSheet, mockOpen } from "@/lib/services/mock";

export const metadata = { title: "Mock Evaluation Term-I — Digital BE Log Book" };

/** HOD approve/unlock view of a group's mock table (F11). */
export default async function HodGroupMockPage({
  params,
  searchParams,
}: {
  params: { groupId: string };
  searchParams?: { print?: string };
}) {
  await requireRole("HOD");
  const sheet = await getMockSheet(params.groupId).catch(() => null);
  if (!sheet) notFound();

  const print = searchParams?.print === "1";

  return (
    <div className="space-y-3">
      {print ? null : (
        <Link
          className="print-hide text-sm text-muted-foreground hover:text-neutral-900"
          href="/hod/mock"
        >
          ‹ Back to mock evaluation
        </Link>
      )}
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
        mode="hod"
        editable={mockOpen(sheet.group.status)}
        print={print}
        printHref={`/hod/mock/${params.groupId}?print=1`}
      />
    </div>
  );
}
