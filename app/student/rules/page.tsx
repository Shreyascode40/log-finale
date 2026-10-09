import { redirect } from "next/navigation";
import { requireRole } from "@/lib/permissions";
import { getStudentGroupInfo } from "@/lib/services/group-info";
import { RulesSheetScreen } from "@/components/student/rules-sheet";

export const metadata = { title: "Rules and Regulations — Digital BE Log Book" };

export default async function StudentRulesPage({
  searchParams,
}: {
  searchParams?: { print?: string };
}) {
  const user = await requireRole("STUDENT");
  const membership = await getStudentGroupInfo(user.id);
  if (!membership) redirect("/student/group");

  const members = membership.group.members.map((member) => ({
    id: member.id,
    name: member.name,
    acknowledgedAt: member.rulesAckAt ? member.rulesAckAt.toISOString() : null,
  }));

  return (
    <RulesSheetScreen
      members={members}
      editable={membership.group.status !== "PDF_GENERATED"}
      print={searchParams?.print === "1"}
    />
  );
}
