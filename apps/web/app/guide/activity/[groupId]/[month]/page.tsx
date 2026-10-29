import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ActivityChartScreen } from "@/components/activity/activity-chart-sheet";
import { MonthTabs } from "@/components/activity/month-tabs";
import { requireRole } from "@/lib/permissions";
import { chartsOpen, getMonthChart, isChartMonth } from "@/lib/services/activity-chart";

export const metadata = { title: "Activity chart — Digital BE Log Book" };

/**
 * Guide verification view of a group's month chart (F9). Only the guide
 * assigned to THIS group may open (and verify) it; the service re-checks on
 * every save.
 */
export default async function GuideGroupActivityMonthPage({
  params,
  searchParams,
}: {
  params: { groupId: string; month: string };
  searchParams?: { print?: string };
}) {
  const user = await requireRole("GUIDE");
  if (!isChartMonth(params.month)) notFound();

  const chart = await getMonthChart(params.groupId, params.month).catch(() => null);
  if (!chart) notFound();
  if (chart.group.guideId !== user.id) redirect("/guide/activity");

  const print = searchParams?.print === "1";

  return (
    <div className="min-h-screen bg-neutral-100">
      {print ? null : (
        <>
          <div className="print-hide border-b bg-white px-4 py-2 text-sm">
            <Link className="text-muted-foreground hover:text-neutral-900" href="/guide/activity">
              ‹ Back to activity verification
            </Link>
          </div>
          <MonthTabs baseHref={`/guide/activity/${params.groupId}`} current={params.month} />
        </>
      )}
      <ActivityChartScreen
        groupId={chart.group.id}
        groupNo={chart.group.groupNo}
        guideName={chart.guideName}
        month={params.month}
        entries={chart.entries}
        mode="guide"
        editable={chartsOpen(chart.group.status)}
        print={print}
        printHref={`/guide/activity/${params.groupId}/${params.month}?print=1`}
      />
    </div>
  );
}
