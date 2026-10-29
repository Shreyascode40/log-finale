/**
 * Fixed-window in-memory rate limiter.
 *
 * Enough for a single-instance deployment and for development. If the app is
 * later scaled horizontally or deployed to serverless, swap the Map for Redis
 * (the call sites do not change).
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
};

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterMs: 0 };
  }

  if (existing.count >= limit) {
    return { ok: false, remaining: 0, retryAfterMs: existing.resetAt - now };
  }

  existing.count += 1;
  return { ok: true, remaining: limit - existing.count, retryAfterMs: 0 };
}

/** Test/maintenance helper. */
export function resetRateLimits(): void {
  buckets.clear();
}

/** Common windows used by the auth endpoints. */
export const RATE_LIMITS = {
  signup: { limit: 5, windowMs: 10 * 60 * 1000 },
  login: { limit: 10, windowMs: 5 * 60 * 1000 },
  passwordReset: { limit: 5, windowMs: 15 * 60 * 1000 },
} as const;
