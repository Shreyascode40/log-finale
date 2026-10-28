import { loadEnv } from "vite";

/**
 * Loads and validates the dedicated test database configuration.
 *
 * Tests create and delete rows, so they must never point at the application's
 * public schema. For a remote PostgreSQL/Supabase database we require an
 * explicit non-public `schema` query parameter. Localhost is allowed without
 * one so a normal local PostgreSQL test database still works.
 */
export function loadTestDatabaseEnv(): {
  databaseUrl: string;
  directUrl: string;
} {
  const fileEnv = loadEnv("test", process.cwd(), "");
  const databaseUrl =
    process.env.TEST_DATABASE_URL ?? fileEnv.TEST_DATABASE_URL;
  const directUrl = process.env.TEST_DIRECT_URL ?? fileEnv.TEST_DIRECT_URL;

  if (!databaseUrl || !directUrl) {
    throw new Error(
      "Missing TEST_DATABASE_URL/TEST_DIRECT_URL. Create `.env.test.local` " +
        "with a dedicated PostgreSQL test database or a separate schema, then " +
        "run the tests again.",
    );
  }

  if (databaseUrl === fileEnv.DATABASE_URL || directUrl === fileEnv.DIRECT_URL) {
    throw new Error(
      "TEST_DATABASE_URL/TEST_DIRECT_URL must not equal the application " +
        "database URLs. Tests reset the schema; use a dedicated database or a " +
        "separate schema.",
    );
  }

  for (const [label, value] of [
    ["TEST_DATABASE_URL", databaseUrl],
    ["TEST_DIRECT_URL", directUrl],
  ] as const) {
    const parsed = new URL(value);
    const schema = parsed.searchParams.get("schema");
    const isLocal = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
    if (!isLocal && (!schema || schema === "public")) {
      throw new Error(
        `${label} must target a non-public schema for remote databases ` +
          "(for example `?schema=logbook_test`). Refusing to reset a shared schema.",
      );
    }
  }

  const databaseSchema = new URL(databaseUrl).searchParams.get("schema");
  const directSchema = new URL(directUrl).searchParams.get("schema");
  if (databaseSchema !== directSchema) {
    throw new Error(
      "TEST_DATABASE_URL and TEST_DIRECT_URL must target the same schema.",
    );
  }

  return { databaseUrl, directUrl };
}
