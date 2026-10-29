import Link from "next/link";
import { notFound } from "next/navigation";
import { EvalSheetScreen } from "@/components/evaluation/eval-sheet";
import { FINAL_T2_COMPONENTS, FINAL_T2_TOTAL } from "@/lib/constants";
import { requireRole } from "@/lib/permissions";
import {
  approveFinalSheetsAction,
  saveFinalSheetsAction,
  submitFinalSheetsAction,
  unlockFinalSheetsAction,
} from "@/lib/actions/final";
import { finalOpen, getFinalSheet } from "@/lib/services/final";

export const metadata = { title: "Final Evaluation Term-II — Digital BE Log Book" };

/** HOD approve/unlock view of a group's final table (F13). */
export default async function HodGroupFinalPage({
  params,
  searchParams,
}: {
  params: { groupId: string };
  searchParams?: { print?: string };
}) {
  await requireRole("HOD");
  const sheet = await getFinalSheet(params.groupId).catch(() => null);
  if (!sheet) notFound();

  const print = searchParams?.print === "1";

  return (
    <div className="space-y-3">
      {print ? null : (
        <Link
          className="print-hide text-sm text-muted-foreground hover:text-neutral-900"
          href="/hod/final"
        >
          ‹ Back to final evaluation
        </Link>
      )}
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
        mode="hod"
        editable={finalOpen(sheet.group.status)}
        print={print}
        printHref={`/hod/final/${params.groupId}?print=1`}
      />
    </div>
  );
}
