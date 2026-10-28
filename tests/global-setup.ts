import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { loadTestDatabaseEnv } from "./test-db";

/**
 * Recreates the dedicated test schema once per Vitest run.
 *
 * We deliberately do not use `prisma migrate deploy/reset` here. Supabase's
 * session pooler keeps a server session alive after Prisma's migration engine
 * exits, which leaves Prisma's session-level advisory lock held and makes the
 * next migration wait forever. Applying the checked-in migration SQL through
 * `prisma db execute` is lock-free and gives every run a clean schema.
 */
function readMigrations(): string {
  const migrationsDir = path.join(process.cwd(), "prisma", "migrations");
  const dirs = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  return dirs
    .map((dir) => {
      const file = path.join(migrationsDir, dir, "migration.sql");
      if (!fs.existsSync(file)) {
        throw new Error(`Missing migration SQL: ${file}`);
      }
      return fs.readFileSync(file, "utf8");
    })
    .join("\n");
}

export default function globalSetup() {
  const { directUrl } = loadTestDatabaseEnv();
  const schema = new URL(directUrl).searchParams.get("schema");
  if (!schema || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
    throw new Error(
      "The test database URL must include a safe `schema` parameter, e.g. " +
        "`?schema=logbook_test`.",
    );
  }

  // One global review template is enough for the completion/PDF suites, which
  // approve every template the database holds. Real deployments seed the full
  // SPEC.md B8 list; tests only need a stable non-empty set.
  const baselineReview = [
    `INSERT INTO "ReviewTemplate" ("id", "term", "reviewType", "title", "order", "hasDateColumn")`,
    `VALUES ('test-baseline-review', 'TERM_I', 'TEST_BASELINE_REVIEW', 'Baseline review', 9999, false);`,
    `INSERT INTO "ReviewQuestion" ("id", "templateId", "questionNo", "text")`,
    `VALUES ('test-baseline-question', 'test-baseline-review', 1, 'Baseline question');`,
  ].join("\n");

  const sql = [
    `DROP SCHEMA IF EXISTS "${schema}" CASCADE;`,
    `CREATE SCHEMA "${schema}";`,
    readMigrations(),
    baselineReview,
  ].join("\n");

  execSync("npx prisma db execute --stdin --schema prisma/schema.prisma", {
    input: sql,
    env: {
      ...process.env,
      DATABASE_URL: directUrl,
      DIRECT_URL: directUrl,
    },
    stdio: ["pipe", "inherit", "inherit"],
  });
}
