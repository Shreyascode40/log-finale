import { redirect } from "next/navigation";
import { ContentSheet } from "@/components/records/content-sheet";
import { requireRole } from "@/lib/permissions";
import { getStudentGroupInfo } from "@/lib/services/group-info";
import { getContentPage } from "@/lib/services/records";

export const metadata = { title: "Project Cost Estimation — Digital BE Log Book" };

/** Student cost estimation free content page (F12). */
export default async function StudentCostPage({
  searchParams,
}: {
  searchParams?: { print?: string };
}) {
  const user = await requireRole("STUDENT");
  const membership = await getStudentGroupInfo(user.id);
  if (!membership) redirect("/student/group");

  const page = await getContentPage(membership.groupId, "COST");

  return (
    <ContentSheet
      pageType="COST"
      title="Project Cost Estimation"
      richText={page.richText ?? ""}
      fileUrl={page.fileUrl}
      editable={membership.group.status !== "PDF_GENERATED"}
      print={searchParams?.print === "1"}
      printHref="/student/cost?print=1"
    />
  );
}
