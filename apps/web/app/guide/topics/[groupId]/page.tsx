import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TopicSheetScreen } from "@/components/topics/topic-sheet";
import { requireRole } from "@/lib/permissions";
import { getTopicSheet, topicsOpen } from "@/lib/services/topic";

export const metadata = { title: "Topic finalization — Digital BE Log Book" };

/**
 * Guide scoring view of a group's Topic Finalization sheets (F8). Only the guide
 * assigned to THIS group may open (and score) it; the service re-checks on save.
 */
export default async function GuideGroupTopicsPage({
  params,
  searchParams,
}: {
  params: { groupId: string };
  searchParams?: { print?: string };
}) {
  const user = await requireRole("GUIDE");
  const sheet = await getTopicSheet(params.groupId).catch(() => null);
  if (!sheet) notFound();
  if (sheet.group.guideId !== user.id) redirect("/guide/topics");

  const print = searchParams?.print === "1";

  return (
    <div className="min-h-screen bg-neutral-100">
      {print ? null : (
        <div className="print-hide border-b bg-white px-4 py-2 text-sm">
          <Link className="text-muted-foreground hover:text-neutral-900" href="/guide/topics">
            ‹ Back to topic scoring
          </Link>
        </div>
      )}
      <TopicSheetScreen
        groupId={sheet.group.id}
        groupNo={sheet.group.groupNo}
        guideName={sheet.guideName}
        topics={sheet.topics}
        mode="guide"
        editable={topicsOpen(sheet.group.status)}
        print={print}
        printHref={`/guide/topics/${params.groupId}?print=1`}
      />
    </div>
  );
}
