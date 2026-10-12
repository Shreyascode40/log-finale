import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "lib/**/*.test.ts"],
    globalSetup: ["./tests/global-setup.ts"],
    // SQLite: keep everything on one worker to avoid write locks.
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    env: {
      // Honour ambient Supabase URLs when set (production parity); otherwise
      // fall back to the throwaway local file (works only while the Prisma
      // provider is sqlite).
      DATABASE_URL: process.env.DATABASE_URL ?? "file:./test.db",
      DIRECT_URL: process.env.DIRECT_URL ?? "",
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
