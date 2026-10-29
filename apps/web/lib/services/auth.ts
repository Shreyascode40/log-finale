import { BackendApiError, backendSystemApi } from "@/lib/backend-api";
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
      | "USER_NOT_FOUND"
      | "EMAIL_FAILED",
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

/**
 * Demo kill-switch for email verification (default ON, per master prompt rule
 * 11). Set REQUIRE_EMAIL_VERIFICATION="false" to let new accounts log in
 * immediately without a verification mail; flip it back to restore the normal
 * flow. Read at call time so tests can toggle it.
 */
export function emailVerificationRequired(): boolean {
  return process.env.REQUIRE_EMAIL_VERIFICATION !== "false";
}

function toAuthError(error: unknown): never {
  if (error instanceof BackendApiError && error.code) {
    throw new AuthError(error.code as AuthError["code"], error.message);
  }
  if (error instanceof Error) {
    throw new AuthError("INVALID_INPUT", error.message);
  }
  throw new AuthError("INVALID_INPUT", String(error));
}

/** Student self-registration via the backend API. */
export async function signupStudent(input: unknown): Promise<{
  userId: string;
  verificationUrl?: string;
}> {
  try {
    return await backendSystemApi<{ userId: string; verificationUrl?: string }>("/v1/auth/signup", {
      method: "POST",
      body: JSON.stringify(input),
    });
  } catch (error) {
    toAuthError(error);
  }
}

/** Credentials check used by NextAuth's `authorize`. */
export async function authenticate(email: string, password: string): Promise<AuthResult> {
  try {
    return await backendSystemApi<AuthResult>("/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  } catch (error) {
    return { ok: false, reason: "INVALID_CREDENTIALS" };
  }
}

/** Consumes a single-use email verification token. */
export async function verifyEmail(rawToken: string): Promise<{ email: string }> {
  try {
    return await backendSystemApi<{ email: string }>("/v1/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token: rawToken }),
    });
  } catch (error) {
    toAuthError(error);
  }
}

/** Starts a password reset via the backend API. */
export async function requestPasswordReset(input: unknown): Promise<{ resetUrl?: string }> {
  try {
    return await backendSystemApi<{ resetUrl?: string }>("/v1/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify(input),
    });
  } catch (error) {
    toAuthError(error);
  }
}

/** Completes a password reset with a single-use token. */
export async function resetPassword(input: unknown): Promise<void> {
  try {
    await backendSystemApi<{ success: true }>("/v1/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(input),
    });
  } catch (error) {
    toAuthError(error);
  }
}
