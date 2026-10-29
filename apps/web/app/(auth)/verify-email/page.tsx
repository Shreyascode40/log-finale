import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AuthError, verifyEmail } from "@/lib/services/auth";

export const metadata = { title: "Verify email — Digital BE Log Book" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams?: { token?: string };
}) {
  const token = searchParams?.token;
  let error: string | null = null;
  let verifiedEmail: string | null = null;

  if (!token) {
    error = "This link is missing its verification token.";
  } else {
    try {
      const result = await verifyEmail(token);
      verifiedEmail = result.email;
    } catch (e) {
      error = e instanceof AuthError ? e.message : "We could not verify this link.";
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email verification</CardTitle>
        <CardDescription>Activate your account to sign in.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {verifiedEmail ? (
          <>
            <Alert>
              <AlertDescription>
                Your email <span className="font-medium">{verifiedEmail}</span> is verified. You can
                now sign in.
              </AlertDescription>
            </Alert>
            <Button asChild className="w-full">
              <Link href="/login">Go to sign in</Link>
            </Button>
          </>
        ) : (
          <>
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button asChild variant="outline" className="w-full">
              <Link href="/login">Back to sign in</Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
