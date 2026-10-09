import { AppHeader } from "@/components/app/app-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/permissions";

export const metadata = { title: "Guide dashboard — Digital BE Log Book" };

export default async function GuideDashboardPage() {
  const user = await requireRole("GUIDE");

  return (
    <div className="min-h-screen bg-neutral-100">
      <AppHeader name={user.name} role="Guide / Reviewer" homeHref="/guide" />
      <main className="mx-auto max-w-4xl space-y-4 px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Welcome, {user.name}</CardTitle>
            <CardDescription>
              Your assigned groups, pending verifications and reviews appear here.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>No groups are assigned to you yet. The HOD assigns one guide per group (F3).</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
