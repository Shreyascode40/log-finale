import { defineConfig } from "vitest/config";
import path from "node:path";
import { loadTestDatabaseEnv } from "./tests/test-db";

/**
 * Tests must never run against the development/production database. They use
 * TEST_DATABASE_URL / TEST_DIRECT_URL, normally supplied by `.env.test.local`
 * (git-ignored). The test URLs point at a separate schema, e.g. `?schema=test`.
 */
const { databaseUrl: testDatabaseUrl, directUrl: testDirectUrl } =
  loadTestDatabaseEnv();

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "lib/**/*.test.ts"],
    globalSetup: ["./tests/global-setup.ts"],
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    // The test database is remote in development; every query crosses the
    // network. Keep the per-test budget well above a local SQLite run.
    testTimeout: 120_000,
    hookTimeout: 120_000,
    env: {
      DATABASE_URL: testDatabaseUrl,
      DIRECT_URL: testDirectUrl,
      // Never let tests write to the production Supabase bucket: upload tests
      // assert the local `/media/...` URL and the bucket may be live.
      UPLOAD_PROVIDER: "local",
      SUPABASE_URL: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      SUPABASE_BUCKET: "",
      EMAIL_PROVIDER: "noop",
      NEXTAUTH_SECRET: "test-secret",
      NEXTAUTH_URL: "http://localhost:3000",
      ALLOWED_EMAIL_DOMAIN: "",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
