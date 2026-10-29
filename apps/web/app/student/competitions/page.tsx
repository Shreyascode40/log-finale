import { redirect } from "next/navigation";
import { CompetitionSheet } from "@/components/records/competition-sheet";
import { requireRole } from "@/lib/permissions";
import { getStudentGroupInfo } from "@/lib/services/group-info";
import { listCompetitions } from "@/lib/services/records";

export const metadata = { title: "Competitions — Digital BE Log Book" };

/** Student competition entries (F12). At least one keeps final-exam eligibility. */
export default async function StudentCompetitionsPage({
  searchParams,
}: {
  searchParams?: { print?: string };
}) {
  const user = await requireRole("STUDENT");
  const membership = await getStudentGroupInfo(user.id);
  if (!membership) redirect("/student/group");

  const entries = await listCompetitions(membership.groupId);

  return (
    <CompetitionSheet
      entries={entries}
      editable={membership.group.status !== "PDF_GENERATED"}
      print={searchParams?.print === "1"}
      printHref="/student/competitions?print=1"
    />
  );
}
