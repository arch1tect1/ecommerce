/**
 * One-shot helper to clear a stuck Prisma migration state on a fresh DB.
 * Connects via DIRECT_URL.
 */
import { PrismaClient } from "@prisma/client";

async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) {
    console.error("DIRECT_URL or DATABASE_URL not set");
    process.exit(1);
  }
  // eslint-disable-next-line no-console
  console.log("Connecting to", url.replace(/:\/\/[^:]+:[^@]+@/, "://***:***@"));
  const prisma = new PrismaClient({ datasources: { db: { url } } });

  try {
    // Identify our own session pid so we don't terminate ourselves.
    const me = await prisma.$queryRaw<{ pg_backend_pid: number }[]>`
      SELECT pg_backend_pid()`;
    const myPid = me[0]?.pg_backend_pid;
    console.log("Our backend pid:", myPid);

    // Find sessions holding the Prisma advisory lock (id 72707369).
    const holders = await prisma.$queryRaw<
      { pid: number; state: string; backend_start: Date }[]
    >`
      SELECT a.pid, a.state, a.backend_start
      FROM pg_locks l
      JOIN pg_stat_activity a ON a.pid = l.pid
      WHERE l.locktype = 'advisory' AND l.classid = 0 AND l.objid = 72707369
    `;
    console.log(`Sessions holding Prisma advisory lock: ${holders.length}`);
    for (const h of holders) {
      const isSelf = h.pid === myPid;
      console.log(
        `  pid=${h.pid} state=${h.state} started=${h.backend_start.toISOString()}${isSelf ? " (self — skipping)" : ""}`
      );
      if (isSelf) continue;
      try {
        const r = await prisma.$queryRaw<{ pg_terminate_backend: boolean }[]>`
          SELECT pg_terminate_backend(${h.pid}::int)`;
        console.log(`    terminated: ${r[0]?.pg_terminate_backend}`);
      } catch (e) {
        console.log(`    terminate failed: ${(e as Error).message}`);
      }
    }

    // Drop the _prisma_migrations table on the off chance one was created.
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "_prisma_migrations"`);
    console.log("Dropped _prisma_migrations table (if existed).");

    // List remaining tables.
    const tables = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name`;
    console.log(`Remaining public tables (${tables.length}):`);
    for (const t of tables) console.log("  -", t.table_name);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
