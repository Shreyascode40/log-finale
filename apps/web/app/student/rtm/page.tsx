import { redirect } from "next/navigation";
import { ContentSheet } from "@/components/records/content-sheet";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { getContentPage } from "@/lib/services/records";

export const metadata = { title: "Requirement Traceability Matrix — Digital BE Log Book" };

/** Student RTM free content page (F12). */
export default async function StudentRtmPage({
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

  const page = await getContentPage(membership.groupId, "RTM");

  return (
    <ContentSheet
      pageType="RTM"
      title="Requirement Traceability Matrix"
      richText={page.richText ?? ""}
      fileUrl={page.fileUrl}
      editable={membership.group.status !== "PDF_GENERATED"}
      print={searchParams?.print === "1"}
      printHref="/student/rtm?print=1"
    />
  );
}
