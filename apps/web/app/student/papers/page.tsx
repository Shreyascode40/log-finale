import { redirect } from "next/navigation";
import { PaperSheet } from "@/components/records/paper-sheet";
import { requireRole } from "@/lib/permissions";
import { getStudentGroupInfo } from "@/lib/services/group-info";
import { listPapers } from "@/lib/services/records";

export const metadata = { title: "Papers — Digital BE Log Book" };

/** Student paper publications (F12). At least one technical paper is required. */
export default async function StudentPapersPage({
  searchParams,
}: {
  searchParams?: { print?: string };
}) {
  const user = await requireRole("STUDENT");
  const membership = await getStudentGroupInfo(user.id);
  if (!membership) redirect("/student/group");

  const entries = await listPapers(membership.groupId);

  return (
    <PaperSheet
      entries={entries}
      editable={membership.group.status !== "PDF_GENERATED"}
      print={searchParams?.print === "1"}
      printHref="/student/papers?print=1"
    />
  );
}
