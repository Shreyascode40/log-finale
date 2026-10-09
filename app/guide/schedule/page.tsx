import { AppHeader } from "@/components/app/app-header";
import { requireRole } from "@/lib/permissions";
import { getSchedule } from "@/lib/services/schedule";
import { ScheduleSheetScreen } from "@/components/schedule/schedule-sheet";

export const metadata = { title: "Project schedule — Digital BE Log Book" };

/**
 * Guide / reviewer view of the Schedule sheet (F7). A guide may edit the date
 * cells just like the HOD; the server action re-checks the role on every save.
 */
export default async function GuideSchedulePage({
  searchParams,
}: {
  searchParams?: { print?: string };
}) {
  const user = await requireRole("GUIDE");
  const terms = await getSchedule();
  const print = searchParams?.print === "1";

  return (
    <div className="min-h-screen bg-neutral-100">
      {print ? null : <AppHeader name={user.name} role="Guide / Reviewer" homeHref="/guide" />}
      <ScheduleSheetScreen terms={terms} editable print={print} />
    </div>
  );
}
