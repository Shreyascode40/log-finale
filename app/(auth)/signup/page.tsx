import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata = { title: "Student sign up — Digital BE Log Book" };

export default function SignupPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Student sign up</CardTitle>
        <CardDescription>
          Student self-registration. Role is set by the server and is always STUDENT.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SignupForm />
        <p className="text-center text-xs">
          Already registered?{" "}
          <Link className="underline" href="/login">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
