import "server-only";

import { createHmac } from "node:crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

function internalToken(userId: string): string {
  const secret = process.env.API_INTERNAL_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("API_INTERNAL_SECRET must contain at least 32 characters.");
  }
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, aud: "be-logbook-api", exp: Math.floor(Date.now() / 1000) + 60 }),
  ).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export async function backendApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Authentication required.");

  const baseUrl = process.env.API_BASE_URL ?? "http://localhost:4000";
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${internalToken(session.user.id)}`);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const response = await fetch(new URL(path, baseUrl), {
    ...init,
    cache: "no-store",
    headers,
  });
  const body = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new Error(body.error ?? `Backend request failed (${response.status}).`);
  return body;
}
