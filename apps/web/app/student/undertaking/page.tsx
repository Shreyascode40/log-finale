import { redirect } from "next/navigation";
import { requireRole } from "@/lib/permissions";
import { getStudentGroupInfo } from "@/lib/services/group-info";
import { UndertakingSheetScreen } from "@/components/student/undertaking-sheet";

export const metadata = { title: "Undertaking — Digital BE Log Book" };

export default async function StudentUndertakingPage({
  searchParams,
}: {
  searchParams?: { print?: string };
}) {
  const user = await requireRole("STUDENT");
  const membership = await getStudentGroupInfo(user.id);
  if (!membership) redirect("/student/group");

  const group = membership.group;
  const members = group.members.map((member) => ({
    id: member.id,
    name: member.name,
    acceptedAt: member.undertakingAcceptedAt ? member.undertakingAcceptedAt.toISOString() : null,
  }));

  return (
    <UndertakingSheetScreen
      department={group.department ?? "Computer"}
      batch={group.academicYear ?? ""}
      academicYear={group.academicYear ?? ""}
      projectTitle={group.projectTitle ?? ""}
      members={members}
      editable={group.status !== "PDF_GENERATED"}
      print={searchParams?.print === "1"}
    />
  );
}
