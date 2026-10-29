import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { toJson } from "../json.js";
import { ApiDomainError } from "../errors.js";
import { hashPassword, verifyPassword } from "../password.js";
import { sendEmail, exposesDevLinks } from "../email.js";
import {
  generateToken,
  hashToken,
  EMAIL_VERIFICATION_TTL_MS,
  PASSWORD_RESET_TTL_MS,
  expiresIn,
} from "../tokens.js";
import type { Role } from "../constants.js";

export class AuthError extends ApiDomainError {
  constructor(
    public readonly code:
      | "INVALID_INPUT"
      | "EMAIL_DOMAIN"
      | "EMAIL_TAKEN"
      | "ROLL_TAKEN"
      | "INVALID_TOKEN"
      | "USER_NOT_FOUND"
      | "EMAIL_FAILED",
    message: string,
    status = 400,
  ) {
    super(code, message, status);
    this.name = "AuthError";
  }
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export type AuthResult =
  | { ok: true; user: SessionUser }
  | { ok: false; reason: "INVALID_CREDENTIALS" | "EMAIL_NOT_VERIFIED" | "ACCOUNT_INACTIVE" };

function baseUrl(): string {
  const url = process.env.WEB_URL || process.env.NEXTAUTH_URL || process.env.APP_URL;
  return url?.replace(/\/$/, "") || "http://localhost:3000";
}

function allowedDomain(): string | null {
  const domain = process.env.ALLOWED_EMAIL_DOMAIN?.trim().toLowerCase();
  return domain ? domain : null;
}

function isAllowedEmail(email: string): boolean {
  const domain = allowedDomain();
  if (!domain) return true;
  return email.toLowerCase().endsWith(`@${domain}`);
}

export function emailVerificationRequired(): boolean {
  return process.env.REQUIRE_EMAIL_VERIFICATION !== "false";
}

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

async function logAction(
  input: { userId: string; action: string; entity: string; entityId: string; before?: unknown; after?: unknown },
  tx: Prisma.TransactionClient,
) {
  await tx.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      before: input.before === undefined ? null : toJson(input.before),
      after: input.after === undefined ? null : toJson(input.after),
    },
  });
}

export async function signupStudent(input: unknown): Promise<{
  userId: string;
  verificationUrl?: string;
}> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    throw new AuthError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { name, email, rollNo, mobile, password } = parsed.data;

  if (!isAllowedEmail(email)) {
    throw new AuthError("EMAIL_DOMAIN", `Sign up is restricted to @${allowedDomain()} email addresses`);
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { rollNo }] },
    select: { email: true, rollNo: true },
  });
  if (existing?.email === email) throw new AuthError("EMAIL_TAKEN", "An account with this email already exists");
  if (existing?.rollNo === rollNo) throw new AuthError("ROLL_TAKEN", "This roll number is already registered");

  const passwordHash = await hashPassword(password);
  const rawToken = generateToken();
  const verificationRequired = emailVerificationRequired();

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name,
        email,
        rollNo,
        mobile,
        passwordHash,
        role: "STUDENT" satisfies Role,
        createdVia: "SELF_SIGNUP",
        ...(verificationRequired ? {} : { emailVerifiedAt: new Date() }),
      },
    });
    if (verificationRequired) {
      await tx.emailVerificationToken.create({
        data: {
          userId: created.id,
          tokenHash: hashToken(rawToken),
          expiresAt: expiresIn(EMAIL_VERIFICATION_TTL_MS),
        },
      });
    }
    await logAction(
      {
        userId: created.id,
        action: "USER_SIGNUP",
        entity: "User",
        entityId: created.id,
        after: { email, rollNo, role: "STUDENT" },
      },
      tx,
    );
    return created;
  });

  if (!verificationRequired) {
    return { userId: user.id };
  }

  const verificationUrl = `${baseUrl()}/verify-email?token=${rawToken}`;
  try {
    await sendEmail({
      to: email,
      subject: "Verify your email — Digital BE Project Log Book",
      text: `Hello ${name},\n\nVerify your email to activate your account:\n${verificationUrl}\n\nThis link expires in 24 hours.`,
    });
  } catch (error) {
    console.error(
      `signup email failed for ${email}: ${error instanceof Error ? error.message : String(error)}`,
    );
    await prisma.$transaction(async (tx) => {
      await tx.emailVerificationToken.deleteMany({ where: { userId: user.id } });
      await tx.auditLog.deleteMany({ where: { userId: user.id } });
      await tx.user.delete({ where: { id: user.id } });
    });
    throw new AuthError(
      "EMAIL_FAILED",
      "We couldn't send the verification email. Please try again later or contact your administrator.",
    );
  }

  return {
    userId: user.id,
    verificationUrl: exposesDevLinks() ? verificationUrl : undefined,
  };
}

export async function authenticate(email: string, password: string): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) return { ok: false, reason: "INVALID_CREDENTIALS" };

  const passwordOk = await verifyPassword(password, user.passwordHash);
  if (!passwordOk) return { ok: false, reason: "INVALID_CREDENTIALS" };

  if (!user.active) return { ok: false, reason: "ACCOUNT_INACTIVE" };
  if (emailVerificationRequired() && !user.emailVerifiedAt) {
    return { ok: false, reason: "EMAIL_NOT_VERIFIED" };
  }

  return {
    ok: true,
    user: { id: user.id, name: user.name, email: user.email, role: user.role as Role },
  };
}

export async function verifyEmail(rawToken: string): Promise<{ email: string }> {
  const token = await prisma.emailVerificationToken.findFirst({
    where: { tokenHash: hashToken(rawToken) },
    include: { user: { select: { id: true, email: true, emailVerifiedAt: true } } },
  });

  if (!token || token.usedAt || token.expiresAt.getTime() < Date.now()) {
    throw new AuthError("INVALID_TOKEN", "This verification link is invalid or has expired");
  }

  await prisma.$transaction(async (tx) => {
    await tx.emailVerificationToken.update({ where: { id: token.id }, data: { usedAt: new Date() } });
    if (!token.user.emailVerifiedAt) {
      await tx.user.update({ where: { id: token.userId }, data: { emailVerifiedAt: new Date() } });
    }
    await logAction(
      {
        userId: token.userId,
        action: "EMAIL_VERIFIED",
        entity: "User",
        entityId: token.userId,
      },
      tx,
    );
  });

  return { email: token.user.email };
}

export async function requestPasswordReset(input: unknown): Promise<{ resetUrl?: string }> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    throw new AuthError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { email } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return {};

  const rawToken = generateToken();
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash: hashToken(rawToken), expiresAt: expiresIn(PASSWORD_RESET_TTL_MS) },
  });

  const resetUrl = `${baseUrl()}/reset-password?token=${rawToken}`;
  try {
    await sendEmail({
      to: user.email,
      subject: "Reset your password — Digital BE Project Log Book",
      text: `Hello ${user.name},\n\nReset your password using this link (valid for 1 hour):\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    });
  } catch (error) {
    console.error(
      `password-reset email failed for ${user.email}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return {};
  }

  return { resetUrl: exposesDevLinks() ? resetUrl : undefined };
}

export async function resetPassword(input: unknown): Promise<void> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    throw new AuthError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { token: rawToken, password } = parsed.data;

  const token = await prisma.passwordResetToken.findFirst({
    where: { tokenHash: hashToken(rawToken) },
  });
  if (!token || token.usedAt || token.expiresAt.getTime() < Date.now()) {
    throw new AuthError("INVALID_TOKEN", "This reset link is invalid or has expired");
  }

  const passwordHash = await hashPassword(password);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: token.userId }, data: { passwordHash } });
    await tx.passwordResetToken.update({ where: { id: token.id }, data: { usedAt: new Date() } });
    await logAction(
      { userId: token.userId, action: "PASSWORD_RESET", entity: "User", entityId: token.userId },
      tx,
    );
  });
}
