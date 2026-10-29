import { redirect } from "next/navigation";
import { ChecklistSheet } from "@/components/records/checklist-sheet";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { getChecklist } from "@/lib/services/records";

export const metadata = { title: "Checklists — Digital BE Log Book" };

/** Student submission checklists Term-I (5) and Term-II (8) (F12). */
export default async function StudentChecklistsPage({
  searchParams,
}: {
  searchParams?: { print?: string };
}) {
  const user = await requireRole("STUDENT");
  const membership = await prisma.groupMember.findFirst({
    where: { userId: user.id },
    include: { group: true },
  });
  if (!membership) redirect("/student/group");

  const print = searchParams?.print === "1";
  const editable = membership.group.status !== "PDF_GENERATED";
  const [termI, termII] = await Promise.all([
    getChecklist(membership.groupId, "TERM_I"),
    getChecklist(membership.groupId, "TERM_II"),
  ]);

  return (
    <>
      <ChecklistSheet
        term="TERM_I"
        title="Submission Checklist Term-I"
        items={termI.items}
        editable={editable}
        print={print}
        printHref="/student/checklists?print=1"
      />
      <ChecklistSheet
        term="TERM_II"
        title="Submission Checklist Term-II"
        items={termII.items}
        editable={editable}
        print={print}
        printHref="/student/checklists?print=1"
      />
    </>
  );
}
