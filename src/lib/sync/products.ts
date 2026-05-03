import { prisma } from "@/lib/prisma";
import { chunks } from "./runner";
import type { ProductInput, ProductsPayload, SyncResult } from "./schemas";

/**
 * Upsert products by externalId. Products with externalId starting with
 * "local-" are admin-created and never touched by sync.
 *
 * `mode: "full"` additionally deactivates any sync-managed product not
 * present in the payload. Locally-created products are excluded from
 * deactivation. Products are NEVER deleted — order history must be
 * preserved.
 */
export async function syncProducts(
  payload: ProductsPayload
): Promise<SyncResult> {
  const errors: SyncResult["errors"] = [];
  let processed = 0;
  let failed = 0;

  if (payload.products.length === 0 && payload.mode !== "full") {
    return { processed, failed, errors };
  }

  // Resolve every category externalId referenced in this payload to a
  // primary key. Missing categories don't fail the row — categoryId is
  // simply set to null for that product. This lets product/category
  // syncs run in any order.
  const catExtIds = Array.from(
    new Set(
      payload.products
        .map((p) => p.categoryExternalId)
        .filter((v): v is string => Boolean(v))
    )
  );
  const categoryIdByExt = new Map<string, string>();
  if (catExtIds.length > 0) {
    const cats = await prisma.category.findMany({
      where: { externalId: { in: catExtIds } },
      select: { id: true, externalId: true },
    });
    for (const c of cats) {
      if (c.externalId) categoryIdByExt.set(c.externalId, c.id);
    }
  }

  // Process in 500-row chunks. Each chunk runs in its own transaction
  // for atomicity. If a chunk fails (rare — e.g. unique-constraint clash),
  // we retry rows individually so a single bad row doesn't fail the
  // entire chunk.
  const seenExternalIds = new Set<string>();
  for (const chunk of chunks(payload.products, 500)) {
    try {
      await prisma.$transaction(
        async (tx) => {
          for (const p of chunk) {
            await upsertProductWithTx(tx, p, categoryIdByExt);
          }
        },
        { timeout: 60_000, maxWait: 10_000 }
      );
      processed += chunk.length;
      for (const p of chunk) seenExternalIds.add(p.externalId);
    } catch (chunkErr) {
      // Retry individually so a single bad row doesn't fail the whole chunk
      for (const p of chunk) {
        try {
          await upsertProductIndividual(p, categoryIdByExt);
          processed++;
          seenExternalIds.add(p.externalId);
        } catch (rowErr) {
          failed++;
          errors.push({
            externalId: p.externalId,
            error: rowErr instanceof Error ? rowErr.message : String(rowErr),
          });
        }
      }
      void chunkErr;
    }
  }

  // Full-mode reconciliation: deactivate sync-managed products absent
  // from the payload. Excludes admin-created (local-*) products.
  if (payload.mode === "full") {
    const seen = Array.from(seenExternalIds);
    const result = await prisma.product.updateMany({
      where: {
        AND: [
          { NOT: { externalId: { startsWith: "local-" } } },
          seen.length > 0 ? { NOT: { externalId: { in: seen } } } : {},
          { isActive: true },
        ],
      },
      data: { isActive: false },
    });
    if (result.count > 0) {
      errors.push({
        error: `[full-mode] deactivated ${result.count} product(s) absent from payload`,
      });
    }
  }

  return { processed, failed, errors };
}

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function upsertProductWithTx(
  tx: TxClient | typeof prisma,
  p: ProductInput,
  categoryIdByExt: Map<string, string>
) {
  const categoryId = p.categoryExternalId
    ? (categoryIdByExt.get(p.categoryExternalId) ?? null)
    : null;
  await tx.product.upsert({
    where: { externalId: p.externalId },
    create: {
      externalId: p.externalId,
      sku: p.sku,
      name: p.name,
      description: p.description ?? null,
      brand: p.brand ?? null,
      categoryId,
      price: p.price,
      stock: p.stock,
      isActive: p.isActive ?? true,
      lastSyncedAt: new Date(),
    },
    update: {
      sku: p.sku,
      name: p.name,
      description: p.description ?? null,
      brand: p.brand ?? null,
      categoryId,
      price: p.price,
      stock: p.stock,
      ...(p.isActive !== undefined ? { isActive: p.isActive } : {}),
      lastSyncedAt: new Date(),
    },
  });
}

async function upsertProductIndividual(
  p: ProductInput,
  categoryIdByExt: Map<string, string>
) {
  await upsertProductWithTx(prisma, p, categoryIdByExt);
}
