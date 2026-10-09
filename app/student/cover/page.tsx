import { redirect } from "next/navigation";
import { requireRole } from "@/lib/permissions";
import { getStudentGroupInfo } from "@/lib/services/group-info";
import { CoverSheetScreen } from "@/components/student/cover-sheet";

export const metadata = { title: "Cover — Digital BE Log Book" };

export default async function StudentCoverPage({
  searchParams,
}: {
  searchParams?: { print?: string };
}) {
  const user = await requireRole("STUDENT");
  const membership = await getStudentGroupInfo(user.id);
  if (!membership) redirect("/student/group");

  const group = membership.group;

  return (
    <CoverSheetScreen
      initial={{
        department: group.department ?? "Computer",
        academicYear: group.academicYear ?? "",
        projectTitle: group.projectTitle ?? "",
        area: group.area ?? "",
        groupNo: group.groupNo ?? "",
      }}
      guideName={group.guide?.name ?? ""}
      editable={group.status !== "PDF_GENERATED"}
      print={searchParams?.print === "1"}
    />
  );
}
