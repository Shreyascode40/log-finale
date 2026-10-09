import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata = { title: "Reset password — Digital BE Log Book" };

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams?: { token?: string };
}) {
  const token = searchParams?.token;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset password</CardTitle>
        <CardDescription>Choose a new password for your account.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <>
            <Alert variant="destructive">
              <AlertDescription>This reset link is missing its token.</AlertDescription>
            </Alert>
            <Button asChild variant="outline" className="w-full">
              <Link href="/forgot-password">Request a new link</Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
