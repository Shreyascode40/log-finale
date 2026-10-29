import { headers } from "next/headers";

/** Best-effort client IP for rate limiting. */
export function clientIp(): string {
  const h = headers();
  const realIp = h.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",").at(-1)?.trim() || "unknown";
  return process.env.NODE_ENV === "production" ? "unknown" : "local";
}
