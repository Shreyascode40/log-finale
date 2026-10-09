import { AppHeader } from "@/components/app/app-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/permissions";

export const metadata = { title: "Student dashboard — Digital BE Log Book" };

export default async function StudentDashboardPage() {
  const user = await requireRole("STUDENT");

  return (
    <div className="min-h-screen bg-neutral-100">
      <AppHeader name={user.name} role="Student" homeHref="/student" />
      <main className="mx-auto max-w-4xl space-y-4 px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Welcome, {user.name}</CardTitle>
            <CardDescription>
              Your logbook dashboard. Group creation and the sheet stepper arrive with F4 and F5.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>You are not in a group yet. Once group onboarding (F4) is built, you will create or join a group here.</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
