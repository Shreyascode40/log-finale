import { requireRole } from "@/lib/permissions";
import { getSchedule } from "@/lib/services/schedule";
import { ScheduleSheetScreen } from "@/components/schedule/schedule-sheet";

export const metadata = { title: "Project schedule — Digital BE Log Book" };

/** Student view of the Schedule sheet (F7). Read-only; only the HOD edits it. */
export default async function StudentSchedulePage({
  searchParams,
}: {
  searchParams?: { print?: string };
}) {
  await requireRole("STUDENT");
  const terms = await getSchedule();

  return (
    <ScheduleSheetScreen terms={terms} editable={false} print={searchParams?.print === "1"} />
  );
}
