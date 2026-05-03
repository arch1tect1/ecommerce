import { prisma } from "../src/lib/prisma";

async function main() {
  const rows = await prisma.syncLog.findMany({
    orderBy: { startedAt: "desc" },
    take: 6,
  });
  for (const r of rows) {
    const errs = r.errorDetails
      ? JSON.stringify(r.errorDetails).slice(0, 120)
      : "null";
    console.log(
      `${r.id}  ${r.syncType.padEnd(11)} ${r.source.padEnd(8)} ${r.status.padEnd(8)} p=${r.recordsProcessed} f=${r.recordsFailed}  errs=${errs}`
    );
  }
  await prisma.$disconnect();
}
main();
