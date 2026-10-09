import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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

/**
 * Guide marking view of a group's final table (F13). Only the guide assigned
 * to THIS group may open (and write) it; the service re-checks on every save.
 */
export default async function GuideGroupFinalPage({
  params,
  searchParams,
}: {
  params: { groupId: string };
  searchParams?: { print?: string };
}) {
  const user = await requireRole("GUIDE");
  const sheet = await getFinalSheet(params.groupId).catch(() => null);
  if (!sheet) notFound();
  if (sheet.group.guideId !== user.id) redirect("/guide/final");

  const print = searchParams?.print === "1";

  return (
    <div className="min-h-screen bg-neutral-100">
      {print ? null : (
        <div className="print-hide border-b bg-white px-4 py-2 text-sm">
          <Link className="text-muted-foreground hover:text-neutral-900" href="/guide/final">
            ‹ Back to final evaluation
          </Link>
        </div>
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
        mode="guide"
        editable={finalOpen(sheet.group.status)}
        print={print}
        printHref={`/guide/final/${params.groupId}?print=1`}
      />
    </div>
  );
}
