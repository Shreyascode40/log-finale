import { redirect } from "next/navigation";
import { CompetitionSheet } from "@/components/records/competition-sheet";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { listCompetitions } from "@/lib/services/records";

export const metadata = { title: "Competitions — Digital BE Log Book" };

/** Student competition entries (F12). At least one keeps final-exam eligibility. */
export default async function StudentCompetitionsPage({
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
