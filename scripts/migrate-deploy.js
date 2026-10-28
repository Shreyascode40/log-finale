/*
 * Production migration entrypoint.
 *
 * Prisma Migrate takes a session-level advisory lock. Supabase's session pooler
 * can keep that server session alive after the migration engine exits, leaving
 * the lock idle and making the next deploy wait on `pg_advisory_lock(72707369)`.
 * Before deploying, clear only an *idle* holder of Prisma's migration lock; an
 * active migration is never terminated. Then run the normal migration command.
 */
const { execSync } = require("node:child_process");
const { PrismaClient } = require("@prisma/client");

const MIGRATION_LOCK_KEY = 72707369;

async function clearIdleMigrationLock(directUrl) {
  if (!directUrl) return;

  const prisma = new PrismaClient({
    datasources: { db: { url: directUrl } },
  });
  try {
    const holders = await prisma.$queryRawUnsafe(
      `SELECT l.pid::text AS pid
         FROM pg_locks l
         JOIN pg_stat_activity a ON a.pid = l.pid
        WHERE l.locktype = 'advisory'
          AND l.database = (SELECT oid FROM pg_database WHERE datname = current_database())
          AND l.objid = ${MIGRATION_LOCK_KEY}
          AND l.granted
          AND a.state = 'idle'
          AND a.state_change < now() - interval '2 minutes'`,
    );

    for (const holder of holders) {
      const pid = Number(holder.pid);
      if (!Number.isSafeInteger(pid)) continue;
      await prisma.$queryRawUnsafe(
        `SELECT pg_terminate_backend(${pid}::int)`,
      );
      console.log(`[migrate] cleared idle Prisma migration lock held by pid ${pid}`);
    }
  } catch (error) {
    // A lock-cleanup failure must not stop a legitimate migration.
    console.warn(`[migrate] lock cleanup skipped: ${error.message}`);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  await clearIdleMigrationLock(process.env.DIRECT_URL);
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: process.env });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
