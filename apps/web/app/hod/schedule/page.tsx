import { requireRole } from "@/lib/permissions";
import { getSchedule } from "@/lib/services/schedule";
import { ScheduleSheetScreen } from "@/components/schedule/schedule-sheet";

export const metadata = { title: "Project schedule — Digital BE Log Book" };

/**
 * HOD view of the Schedule sheet (F7). The HOD is the only role allowed to edit
 * the date cells; the server action re-checks that role on every save.
 */
export default async function HodSchedulePage({
  searchParams,
}: {
  searchParams?: { print?: string };
}) {
  await requireRole("HOD");
  const terms = await getSchedule();

  return (
    <ScheduleSheetScreen terms={terms} editable print={searchParams?.print === "1"} />
  );
}
