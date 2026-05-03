import { prisma } from "@/lib/prisma";
import { chunks } from "./runner";
import type { PricesPayload, SyncResult } from "./schemas";

/** Lightweight price-only refresh. Same shape as syncStock. */
export async function syncPrices(payload: PricesPayload): Promise<SyncResult> {
  const errors: SyncResult["errors"] = [];
  let processed = 0;
  let failed = 0;

  for (const chunk of chunks(payload.items, 500)) {
    const existing = await prisma.product.findMany({
      where: { externalId: { in: chunk.map((c) => c.externalId) } },
      select: { externalId: true },
    });
    const existingSet = new Set(existing.map((e) => e.externalId));

    const updates = chunk.filter((c) => existingSet.has(c.externalId));
    const missing = chunk.filter((c) => !existingSet.has(c.externalId));

    for (const m of missing) {
      failed++;
      errors.push({
        externalId: m.externalId,
        error: "product not found — run /api/sync/1c/products first",
      });
    }

    if (updates.length === 0) continue;

    try {
      await prisma.$transaction(
        async (tx) => {
          for (const u of updates) {
            await tx.product.update({
              where: { externalId: u.externalId },
              data: { price: u.price, lastSyncedAt: new Date() },
            });
          }
        },
        { timeout: 60_000, maxWait: 10_000 }
      );
      processed += updates.length;
    } catch {
      for (const u of updates) {
        try {
          await prisma.product.update({
            where: { externalId: u.externalId },
            data: { price: u.price, lastSyncedAt: new Date() },
          });
          processed++;
        } catch (e) {
          failed++;
          errors.push({
            externalId: u.externalId,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
    }
  }

  return { processed, failed, errors };
}
