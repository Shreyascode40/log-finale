import { redirect } from "next/navigation";
import { requireRole } from "@/lib/permissions";
import { getStudentGroupInfo } from "@/lib/services/group-info";
import { MembersSheetScreen, type MemberRow } from "@/components/student/members-sheet";

export const metadata = { title: "Group Information — Digital BE Log Book" };

export default async function StudentMembersPage({
  searchParams,
}: {
  searchParams?: { print?: string };
}) {
  const user = await requireRole("STUDENT");
  const membership = await getStudentGroupInfo(user.id);
  if (!membership) redirect("/student/group");

  const members = membership.group.members;

  // The printed sheet always has four member slots; pad with placeholders.
  const slots: MemberRow[] = [0, 1, 2, 3].map((i) => {
    const member = members[i];
    if (!member) {
      return {
        id: `slot-${i}`,
        placeholder: true,
        name: "",
        teResult: "",
        rollNo: "",
        examSeatNo: "",
        mobile: "",
        email: "",
        contribution: "",
        photoUrl: "",
      };
    }
    return {
      id: member.id,
      placeholder: false,
      name: member.name ?? "",
      teResult: member.teResult ?? "",
      rollNo: member.rollNo ?? "",
      examSeatNo: member.examSeatNo ?? "",
      mobile: member.mobile ?? "",
      email: member.email ?? "",
      contribution: member.contribution ?? "",
      photoUrl: member.photoUrl ?? "",
    };
  });

  return (
    <MembersSheetScreen
      initial={slots}
      editable={membership.group.status !== "PDF_GENERATED"}
      print={searchParams?.print === "1"}
    />
  );
}
