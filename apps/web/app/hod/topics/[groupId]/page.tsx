import Link from "next/link";
import { notFound } from "next/navigation";
import { TopicSheetScreen } from "@/components/topics/topic-sheet";
import { requireRole } from "@/lib/permissions";
import { getTopicSheet, topicsOpen } from "@/lib/services/topic";

export const metadata = { title: "Topic finalization — Digital BE Log Book" };

/** HOD decision view of a group's Topic Finalization sheets (F8). */
export default async function HodGroupTopicsPage({
  params,
  searchParams,
}: {
  params: { groupId: string };
  searchParams?: { print?: string };
}) {
  await requireRole("HOD");
  const sheet = await getTopicSheet(params.groupId).catch(() => null);
  if (!sheet) notFound();

  const print = searchParams?.print === "1";

  return (
    <div className="space-y-3">
      {print ? null : (
        <Link
          className="print-hide text-sm text-muted-foreground hover:text-neutral-900"
          href="/hod/topics"
        >
          ‹ Back to topic approvals
        </Link>
      )}
      <TopicSheetScreen
        groupId={sheet.group.id}
        groupNo={sheet.group.groupNo}
        guideName={sheet.guideName}
        topics={sheet.topics}
        mode="hod"
        editable={topicsOpen(sheet.group.status)}
        print={print}
        printHref={`/hod/topics/${params.groupId}?print=1`}
      />
    </div>
  );
}
