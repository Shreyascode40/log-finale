"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/auth/password-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { signUpAction } from "@/lib/actions/auth";
import { signupSchema } from "@/lib/validation/auth";

type SignupValues = z.infer<typeof signupSchema>;

export function SignupForm({ verificationRequired }: { verificationRequired: boolean }) {
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<{ verificationUrl?: string } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", rollNo: "", mobile: "", password: "" },
  });

  async function onSubmit(values: SignupValues) {
    setFormError(null);
    const result = await signUpAction(values);
    if (!result.success) {
      setFormError(result.error);
      return;
    }
    setDone(result.data);
  }

  if (done) {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertDescription>
            {verificationRequired
              ? "Account created. We sent a verification link to your email — open it to activate your account, then sign in."
              : "Account created. You can sign in right away — no verification needed."}
          </AlertDescription>
        </Alert>
        {done.verificationUrl ? (
          <Alert>
            <AlertDescription>
              <span className="font-medium">Development mode:</span> no mailbox is configured, so
              use this link directly.{" "}
              <Link className="underline" href={done.verificationUrl}>
                Verify my email
              </Link>
            </AlertDescription>
          </Alert>
        ) : null}
        <Button asChild className="w-full">
          <Link href="/login">Go to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {formError ? (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-1">
        <Label htmlFor="name">Full name</Label>
        <Input id="name" {...register("name")} />
        {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
      </div>

      <div className="space-y-1">
        <Label htmlFor="email">College email</Label>
        <Input id="email" type="email" autoComplete="email" {...register("email")} />
        {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="rollNo">Roll number</Label>
          <Input id="rollNo" {...register("rollNo")} />
          {errors.rollNo ? <p className="text-xs text-destructive">{errors.rollNo.message}</p> : null}
        </div>

        <div className="space-y-1">
          <Label htmlFor="mobile">Mobile number</Label>
          <Input id="mobile" inputMode="numeric" {...register("mobile")} />
          {errors.mobile ? <p className="text-xs text-destructive">{errors.mobile.message}</p> : null}
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="password">Password</Label>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          {...register("password")}
        />
        {errors.password ? (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">At least 8 characters.</p>
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Creating account…" : "Create student account"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Staff accounts (guide / HOD) are created by the Head of Department, not here.
      </p>
    </form>
  );
}
