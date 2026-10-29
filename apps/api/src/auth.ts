import { createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";

export type ApiIdentity = { userId: string };

function secret(): string {
  const value = process.env.API_INTERNAL_SECRET;
  if (!value || value.length < 32) {
    throw new Error("API_INTERNAL_SECRET must contain at least 32 characters.");
  }
  return value;
}

export function readInternalIdentity(request: IncomingMessage): ApiIdentity | null {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length);
  const [payload, providedSignature, extra] = token.split(".");
  if (!payload || !providedSignature || extra) return null;

  const expected = createHmac("sha256", secret()).update(payload).digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(providedSignature, "base64url");
  } catch {
    return null;
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      sub?: unknown;
      aud?: unknown;
      exp?: unknown;
    };
    if (
      typeof claims.sub !== "string" ||
      claims.aud !== "be-logbook-api" ||
      typeof claims.exp !== "number" ||
      claims.exp <= Math.floor(Date.now() / 1000)
    ) return null;
    return { userId: claims.sub };
  } catch {
    return null;
  }
}
