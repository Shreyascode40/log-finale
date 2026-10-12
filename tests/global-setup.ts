import { execSync } from "node:child_process";

/**
 * Prepares the throwaway test database once per Vitest run by applying
 * the existing migrations. `prisma/test.db` is git-ignored.
 * Respects ambient DATABASE_URL/DIRECT_URL so the suite can run against
 * Supabase; defaults to the local file (SQLite provider only).
 */
export default function globalSetup() {
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL ?? "file:./test.db",
      DIRECT_URL: process.env.DIRECT_URL ?? "",
    },
  });
}
