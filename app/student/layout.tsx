import { AppHeader } from "@/components/app/app-header";
import { StudentNav } from "@/components/app/student-nav";
import { requireRole } from "@/lib/permissions";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("STUDENT");
  return (
    <div className="min-h-screen bg-neutral-100">
      <AppHeader name={user.name} role="Student" homeHref="/student" />
      <StudentNav />
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
