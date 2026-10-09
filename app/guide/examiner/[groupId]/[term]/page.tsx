import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ExaminerSheetScreen } from "@/components/examiner/examiner-sheet";
import { requireRole } from "@/lib/permissions";
import { examinerOpen, getExaminerSheet } from "@/lib/services/examiner";
import { examinerTermSchema } from "@/lib/validation/examiner";

export const metadata = { title: "External Examiner Feedback — Digital BE Log Book" };

const TERM_LABELS = { TERM_I: "Term-I", TERM_II: "Term-II" } as const;
const TERM_TABS = [
  { term: "TERM_I", label: "Term-I" },
  { term: "TERM_II", label: "Term-II" },
] as const;

/**
 * Guide recording view of a group's examiner feedback (F11/F13). Only the
 * guide assigned to THIS group may open (and record) it.
 */
export default async function GuideGroupExaminerTermPage({
  params,
  searchParams,
}: {
  params: { groupId: string; term: string };
  searchParams?: { print?: string };
}) {
  const user = await requireRole("GUIDE");
  const parsed = examinerTermSchema.safeParse(params.term);
  if (!parsed.success) notFound();

  const sheet = await getExaminerSheet(params.groupId, parsed.data).catch(() => null);
  if (!sheet) notFound();
  if (sheet.group.guideId !== user.id) redirect("/guide/examiner");

  const print = searchParams?.print === "1";

  return (
    <div className="min-h-screen bg-neutral-100">
      {print ? null : (
        <>
          <div className="print-hide border-b bg-white px-4 py-2 text-sm">
            <Link className="text-muted-foreground hover:text-neutral-900" href="/guide/examiner">
              ‹ Back to examiner feedback
            </Link>
          </div>
          <nav aria-label="Examiner terms" className="print-hide border-b bg-white">
            <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
              {TERM_TABS.map((tab) => {
                const active = tab.term === parsed.data;
                return (
                  <Link
                    key={tab.term}
                    href={`/guide/examiner/${params.groupId}/${tab.term}`}
                    aria-current={active ? "page" : undefined}
                    className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${
                      active
                        ? "border-neutral-900 font-medium text-neutral-900"
                        : "border-transparent text-muted-foreground hover:text-neutral-900"
                    }`}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        </>
      )}
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
        mode="guide"
        editable={examinerOpen(sheet.group.status)}
        print={print}
        printHref={`/guide/examiner/${params.groupId}/${parsed.data}?print=1`}
      />
    </div>
  );
}
