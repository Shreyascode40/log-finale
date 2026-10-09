import Link from "next/link";
import { notFound } from "next/navigation";
import { ChecklistSheet } from "@/components/records/checklist-sheet";
import { CompetitionSheet } from "@/components/records/competition-sheet";
import { ContentSheet } from "@/components/records/content-sheet";
import { NotesSheet } from "@/components/records/notes-sheet";
import { PaperSheet } from "@/components/records/paper-sheet";
import { requireRole } from "@/lib/permissions";
import { getGroupRecords } from "@/lib/services/records";

export const metadata = { title: "Group records — Digital BE Log Book" };

/** HOD read-only view of one group's F12 records, reusing the same sheets. */
export default async function HodGroupRecordsPage({
  params,
  searchParams,
}: {
  params: { groupId: string };
  searchParams?: { print?: string };
}) {
  await requireRole("HOD");
  const records = await getGroupRecords(params.groupId).catch(() => null);
  if (!records) notFound();

  const print = searchParams?.print === "1";
  const printHref = `/hod/records/${params.groupId}?print=1`;

  return (
    <div className="space-y-3">
      {print ? null : (
        <Link
          className="print-hide text-sm text-muted-foreground hover:text-neutral-900"
          href="/hod/records"
        >
          ‹ Back to group records
        </Link>
      )}
      <CompetitionSheet entries={records.competitions} editable={false} print={print} printHref={printHref} />
      <PaperSheet entries={records.papers} editable={false} print={print} printHref={printHref} />
      {records.checklists.map((checklist) => (
        <ChecklistSheet
          key={checklist.term}
          term={checklist.term as "TERM_I" | "TERM_II"}
          title={checklist.term === "TERM_I" ? "Submission Checklist Term-I" : "Submission Checklist Term-II"}
          items={checklist.items}
          editable={false}
          print={print}
          printHref={printHref}
        />
      ))}
      <ContentSheet
        pageType="RTM"
        title="Requirement Traceability Matrix"
        richText={records.rtm.richText ?? ""}
        fileUrl={records.rtm.fileUrl}
        editable={false}
        print={print}
        printHref={printHref}
      />
      <ContentSheet
        pageType="COST"
        title="Project Cost Estimation"
        richText={records.cost.richText ?? ""}
        fileUrl={records.cost.fileUrl}
        editable={false}
        print={print}
        printHref={printHref}
      />
      <NotesSheet
        notes={records.notes.map((note) => ({ id: note.id, text: note.richText ?? "" }))}
        editable={false}
        print={print}
        printHref={printHref}
      />
    </div>
  );
}
