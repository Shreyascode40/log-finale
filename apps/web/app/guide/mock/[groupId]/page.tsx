import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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

/**
 * Guide marking view of a group's mock table (F11). Only the guide assigned to
 * THIS group may open (and write) it; the service re-checks on every save.
 */
export default async function GuideGroupMockPage({
  params,
  searchParams,
}: {
  params: { groupId: string };
  searchParams?: { print?: string };
}) {
  const user = await requireRole("GUIDE");
  const sheet = await getMockSheet(params.groupId).catch(() => null);
  if (!sheet) notFound();
  if (sheet.group.guideId !== user.id) redirect("/guide/mock");

  const print = searchParams?.print === "1";

  return (
    <div className="min-h-screen bg-neutral-100">
      {print ? null : (
        <div className="print-hide border-b bg-white px-4 py-2 text-sm">
          <Link className="text-muted-foreground hover:text-neutral-900" href="/guide/mock">
            ‹ Back to mock evaluation
          </Link>
        </div>
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
        mode="guide"
        editable={mockOpen(sheet.group.status)}
        print={print}
        printHref={`/guide/mock/${params.groupId}?print=1`}
      />
    </div>
  );
}
