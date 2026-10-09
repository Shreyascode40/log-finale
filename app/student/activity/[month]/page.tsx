import { notFound, redirect } from "next/navigation";
import { ActivityChartScreen } from "@/components/activity/activity-chart-sheet";
import { MonthTabs } from "@/components/activity/month-tabs";
import { requireRole } from "@/lib/permissions";
import { chartsOpen, getMonthChart, getStudentChartGroupId, isChartMonth } from "@/lib/services/activity-chart";

export const metadata = { title: "Activity chart — Digital BE Log Book" };

/**
 * Student view of one month's Activity Chart (F9). Any member of the group may
 * enter the date, tick Complete/Incomplete and confirm a row; the assigned
 * guide verifies it. Charts unlock only once the group is ACTIVE (rule 12).
 */
export default async function StudentActivityMonthPage({
  params,
  searchParams,
}: {
  params: { month: string };
  searchParams?: { print?: string };
}) {
  const user = await requireRole("STUDENT");
  if (!isChartMonth(params.month)) notFound();

  const groupId = await getStudentChartGroupId(user.id);
  if (!groupId) redirect("/student/group");

  const chart = await getMonthChart(groupId, params.month);
  const print = searchParams?.print === "1";

  return (
    <div>
      {print ? null : <MonthTabs baseHref="/student/activity" current={params.month} />}
      <ActivityChartScreen
        groupId={chart.group.id}
        groupNo={chart.group.groupNo}
        guideName={chart.guideName}
        month={params.month}
        entries={chart.entries}
        mode="student"
        editable={chartsOpen(chart.group.status)}
        print={print}
        printHref={`/student/activity/${params.month}?print=1`}
      />
    </div>
  );
}
