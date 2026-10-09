import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { sendEmail, exposesDevLinks } from "@/lib/email";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  EMAIL_VERIFICATION_TTL_MS,
  PASSWORD_RESET_TTL_MS,
  expiresIn,
  generateToken,
  hashToken,
} from "@/lib/tokens";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/lib/validation/auth";
import type { Role } from "@/lib/constants";

/** Typed, user-safe failure surfaced by server actions. */
export class AuthError extends Error {
  constructor(
    public code:
      | "INVALID_INPUT"
      | "EMAIL_DOMAIN"
      | "EMAIL_TAKEN"
      | "ROLL_TAKEN"
      | "INVALID_TOKEN"
      | "USER_NOT_FOUND",
    message: string,
  ) {
    super(message);
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
  return process.env.NEXTAUTH_URL?.replace(/\/$/, "") || "http://localhost:3000";
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

/**
 * Student self-registration.
 *
 * The role is hard-coded to STUDENT here: even if a caller passes `role`, the
 * Zod schema strips it (master prompt rule 11).
 */
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

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name,
        email,
        rollNo,
        mobile,
        passwordHash,
        // role is never taken from the client
        role: "STUDENT" satisfies Role,
        createdVia: "SELF_SIGNUP",
      },
    });
    await tx.emailVerificationToken.create({
      data: {
        userId: created.id,
        tokenHash: hashToken(rawToken),
        expiresAt: expiresIn(EMAIL_VERIFICATION_TTL_MS),
      },
    });
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

  const verificationUrl = `${baseUrl()}/verify-email?token=${rawToken}`;
  await sendEmail({
    to: email,
    subject: "Verify your email — Digital BE Project Log Book",
    text: `Hello ${name},\n\nVerify your email to activate your account:\n${verificationUrl}\n\nThis link expires in 24 hours.`,
  });

  return {
    userId: user.id,
    // Only echoed back in development so the flow can be demoed without a mailbox.
    verificationUrl: exposesDevLinks() ? verificationUrl : undefined,
  };
}

/** Credentials check used by NextAuth's `authorize`. */
export async function authenticate(email: string, password: string): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) return { ok: false, reason: "INVALID_CREDENTIALS" };

  const passwordOk = await verifyPassword(password, user.passwordHash);
  if (!passwordOk) return { ok: false, reason: "INVALID_CREDENTIALS" };

  if (!user.active) return { ok: false, reason: "ACCOUNT_INACTIVE" };
  if (!user.emailVerifiedAt) return { ok: false, reason: "EMAIL_NOT_VERIFIED" };

  return {
    ok: true,
    user: { id: user.id, name: user.name, email: user.email, role: user.role as Role },
  };
}

/** Consumes a single-use email verification token. */
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

/**
 * Starts a password reset. Always resolves, so the endpoint does not reveal
 * whether an address is registered.
 */
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
  await sendEmail({
    to: user.email,
    subject: "Reset your password — Digital BE Project Log Book",
    text: `Hello ${user.name},\n\nReset your password using this link (valid for 1 hour):\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
  });

  return { resetUrl: exposesDevLinks() ? resetUrl : undefined };
}

/** Completes a password reset with a single-use token. */
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
