import { AppHeader } from "@/components/app/app-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/permissions";

export const metadata = { title: "HOD dashboard — Digital BE Log Book" };

const PENDING = [
  "Guide accounts (F3)",
  "Group approval and guide assignment (F3)",
  "Topic and marks approvals (F8, F10)",
  "PDF permissions (F16)",
  "Audit log (F3)",
];

export default async function HodDashboardPage() {
  const user = await requireRole("HOD");

  return (
    <div className="min-h-screen bg-neutral-100">
      <AppHeader name={user.name} role="Head of Department" homeHref="/hod" />
      <main className="mx-auto max-w-4xl space-y-4 px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Welcome, {user.name}</CardTitle>
            <CardDescription>Department-wide control of the logbook.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-2 text-sm font-medium">Coming next:</p>
            <ul className="list-inside list-disc text-sm text-muted-foreground">
              {PENDING.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
