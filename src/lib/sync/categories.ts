import { prisma } from "@/lib/prisma";
import { chunks } from "./runner";
import type { CategoriesPayload, SyncResult } from "./schemas";

/**
 * Two-pass category upsert:
 *   1. Upsert every category WITHOUT parent linkage (so order doesn't matter).
 *   2. Resolve parentExternalId → parentId and update.
 * This handles arbitrary insertion order including reparenting.
 */
export async function syncCategories(
  payload: CategoriesPayload
): Promise<SyncResult> {
  const errors: SyncResult["errors"] = [];
  let processed = 0;
  let failed = 0;

  // Pass 1 — upsert basics, in chunks
  for (const chunk of chunks(payload.categories, 500)) {
    try {
      await prisma.$transaction(
        async (tx) => {
          for (const c of chunk) {
            await tx.category.upsert({
              where: { externalId: c.externalId },
              create: {
                externalId: c.externalId,
                name: c.name,
                slug: slugify(c.name, c.externalId),
              },
              update: { name: c.name },
            });
          }
        },
        { timeout: 60_000, maxWait: 10_000 }
      );
      processed += chunk.length;
    } catch {
      for (const c of chunk) {
        try {
          await prisma.category.upsert({
            where: { externalId: c.externalId },
            create: {
              externalId: c.externalId,
              name: c.name,
              slug: slugify(c.name, c.externalId),
            },
            update: { name: c.name },
          });
          processed++;
        } catch (e) {
          failed++;
          errors.push({
            externalId: c.externalId,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
    }
  }

  // Pass 2 — resolve parents
  const allExtIds = payload.categories.map((c) => c.externalId);
  const existing = await prisma.category.findMany({
    where: { externalId: { in: allExtIds } },
    select: { id: true, externalId: true },
  });
  const idByExt = new Map(
    existing.map((e) => [e.externalId!, e.id] as const)
  );

  // Cycle detection: build adjacency, walk to root, abort row on cycle.
  const intendedParent = new Map<string, string | null>();
  for (const c of payload.categories) {
    intendedParent.set(
      c.externalId,
      c.parentExternalId ?? null
    );
  }
  function detectsCycle(start: string): boolean {
    const seen = new Set<string>();
    let cur: string | null = start;
    while (cur) {
      if (seen.has(cur)) return true;
      seen.add(cur);
      cur = intendedParent.get(cur) ?? null;
    }
    return false;
  }

  for (const chunk of chunks(payload.categories, 500)) {
    const updates: { id: string; parentId: string | null; ext: string }[] = [];
    for (const c of chunk) {
      const id = idByExt.get(c.externalId);
      if (!id) continue;
      let parentId: string | null = null;
      if (c.parentExternalId) {
        parentId = idByExt.get(c.parentExternalId) ?? null;
        if (!parentId) {
          errors.push({
            externalId: c.externalId,
            error: `parent ${c.parentExternalId} not found`,
          });
        }
        if (detectsCycle(c.externalId)) {
          errors.push({
            externalId: c.externalId,
            error: "would create a cycle — parent ignored",
          });
          parentId = null;
        }
      }
      updates.push({ id, parentId, ext: c.externalId });
    }
    if (updates.length === 0) continue;
    try {
      await prisma.$transaction(
        async (tx) => {
          for (const u of updates) {
            await tx.category.update({
              where: { id: u.id },
              data: { parentId: u.parentId },
            });
          }
        },
        { timeout: 60_000, maxWait: 10_000 }
      );
    } catch {
      for (const u of updates) {
        try {
          await prisma.category.update({
            where: { id: u.id },
            data: { parentId: u.parentId },
          });
        } catch (e) {
          errors.push({
            externalId: u.ext,
            error: `parent update failed: ${e instanceof Error ? e.message : String(e)}`,
          });
        }
      }
    }
  }

  return { processed, failed, errors };
}

function slugify(name: string, externalId: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base ? `${base}-${externalId.slice(0, 8)}` : `cat-${externalId.slice(0, 8)}`;
}
