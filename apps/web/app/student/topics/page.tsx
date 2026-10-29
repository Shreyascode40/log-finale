import { redirect } from "next/navigation";
import { TopicSheetScreen } from "@/components/topics/topic-sheet";
import { requireRole } from "@/lib/permissions";
import { getStudentTopicGroupId, getTopicSheet, topicsOpen } from "@/lib/services/topic";

export const metadata = { title: "Topic finalization — Digital BE Log Book" };

/**
 * Student view of the two Topic Finalization sheets (F8). Any member of the
 * group may write the title and description; the guide scores and the HOD
 * decides. Editing unlocks only once the group is ACTIVE (master prompt rule 12).
 */
export default async function StudentTopicsPage({
  searchParams,
}: {
  searchParams?: { print?: string };
}) {
  const user = await requireRole("STUDENT");
  const groupId = await getStudentTopicGroupId(user.id);
  if (!groupId) redirect("/student/group");

  const sheet = await getTopicSheet(groupId);

  return (
    <TopicSheetScreen
      groupId={sheet.group.id}
      groupNo={sheet.group.groupNo}
      guideName={sheet.guideName}
      topics={sheet.topics}
      mode="student"
      editable={topicsOpen(sheet.group.status)}
      print={searchParams?.print === "1"}
      printHref="/student/topics?print=1"
    />
  );
}
