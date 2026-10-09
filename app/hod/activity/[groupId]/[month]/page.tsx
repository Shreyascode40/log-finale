import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityChartScreen } from "@/components/activity/activity-chart-sheet";
import { MonthTabs } from "@/components/activity/month-tabs";
import { requireRole } from "@/lib/permissions";
import { getMonthChart, isChartMonth } from "@/lib/services/activity-chart";

export const metadata = { title: "Activity chart — Digital BE Log Book" };

/** HOD read-only view of a group's month chart (F9). */
export default async function HodGroupActivityMonthPage({
  params,
  searchParams,
}: {
  params: { groupId: string; month: string };
  searchParams?: { print?: string };
}) {
  await requireRole("HOD");
  if (!isChartMonth(params.month)) notFound();

  const chart = await getMonthChart(params.groupId, params.month).catch(() => null);
  if (!chart) notFound();

  const print = searchParams?.print === "1";

  return (
    <div className="space-y-3">
      {print ? null : (
        <>
          <Link
            className="print-hide text-sm text-muted-foreground hover:text-neutral-900"
            href="/hod/activity"
          >
            ‹ Back to activity charts
          </Link>
          <MonthTabs baseHref={`/hod/activity/${params.groupId}`} current={params.month} />
        </>
      )}
      <ActivityChartScreen
        groupId={chart.group.id}
        groupNo={chart.group.groupNo}
        guideName={chart.guideName}
        month={params.month}
        entries={chart.entries}
        mode="hod"
        editable={false}
        print={print}
        printHref={`/hod/activity/${params.groupId}/${params.month}?print=1`}
      />
    </div>
  );
}
