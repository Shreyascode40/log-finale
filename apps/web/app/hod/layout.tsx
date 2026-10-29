import { AppHeader } from "@/components/app/app-header";
import { HodNav } from "@/components/app/hod-nav";
import { requireRole } from "@/lib/permissions";

export default async function HodLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("HOD");
  return (
    <div className="min-h-screen bg-neutral-100">
      <AppHeader name={user.name} role="Head of Department" homeHref="/hod" />
      <HodNav />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
