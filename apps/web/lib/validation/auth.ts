import { z } from "zod";

/**
 * One Zod schema per auth form (SPEC.md / master prompt: lib/validation/<module>.ts).
 *
 * Note: Zod object schemas strip unknown keys by default. That is what makes
 * "the client cannot choose a role" true at the validation layer — a `role`
 * field posted to /signup is removed before it can reach the database.
 */

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password is too long");

export const signupSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  rollNo: z.string().trim().min(1, "Roll number is required").max(30),
  mobile: z.string().trim().regex(/^\d{10}$/, "Mobile number must be 10 digits"),
  password: passwordSchema,
});

export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10, "Missing or invalid reset token"),
  password: passwordSchema,
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
