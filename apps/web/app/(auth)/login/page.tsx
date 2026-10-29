import { Suspense } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "Sign in — Digital BE Log Book" };

export default function LoginPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Students, guides and the HOD use this page.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
        <div className="flex justify-between text-xs">
          <Link className="underline" href="/signup">
            Create a student account
          </Link>
          <Link className="underline" href="/forgot-password">
            Forgot password?
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
