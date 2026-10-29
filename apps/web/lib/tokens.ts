import { createHash, randomBytes } from "node:crypto";

/**
 * Tokens for email verification and password reset.
 *
 * The raw token goes in the emailed link; only its SHA-256 hash is stored, so a
 * database leak does not reveal usable links. A fresh token is always required
 * (single use: `usedAt` is set the moment it is consumed).
 */

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Default lifetimes. */
export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24h
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1h

export function expiresIn(ttlMs: number, from: Date = new Date()): Date {
  return new Date(from.getTime() + ttlMs);
}
