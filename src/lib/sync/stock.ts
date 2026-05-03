import { prisma } from "@/lib/prisma";
import { chunks } from "./runner";
import type { StockPayload, SyncResult } from "./schemas";

/**
 * Lightweight stock-only refresh. Updates `stock` and `lastSyncedAt` for
 * existing products. Missing externalIds are counted as failed (the
 * record didn't exist — products sync should run first).
 */
export async function syncStock(payload: StockPayload): Promise<SyncResult> {
  const errors: SyncResult["errors"] = [];
  let processed = 0;
  let failed = 0;

  for (const chunk of chunks(payload.items, 500)) {
    // First: find which externalIds exist
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
              data: { stock: u.stock, lastSyncedAt: new Date() },
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
            data: { stock: u.stock, lastSyncedAt: new Date() },
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
