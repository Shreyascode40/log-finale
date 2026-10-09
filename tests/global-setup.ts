import { execSync } from "node:child_process";

/**
 * Prepares the throwaway SQLite test database once per Vitest run by applying
 * the existing migrations. `prisma/test.db` is git-ignored.
 */
export default function globalSetup() {
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
  });
}
