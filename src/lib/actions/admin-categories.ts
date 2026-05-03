"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "MANAGER")) {
    throw new Error("Unauthorized");
  }
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

const categorySchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  parentId: z.string().nullable().optional(),
});

// ── Create ─────────────────────────────────────────────────────────────────

export async function createCategoryAction(input: {
  name: string;
  parentId?: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    await requireAdmin();
    const parsed = categorySchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid" };
    }

    let slug = slugify(parsed.data.name);
    if (!slug) slug = `cat-${Date.now()}`;

    // Resolve slug collisions with a numeric suffix
    let attempt = slug;
    let i = 1;
    while (await prisma.category.findUnique({ where: { slug: attempt } })) {
      attempt = `${slug}-${i++}`;
    }

    const cat = await prisma.category.create({
      data: {
        name: parsed.data.name.trim(),
        slug: attempt,
        parentId: parsed.data.parentId || null,
      },
      select: { id: true },
    });
    revalidatePath("/admin/categories");
    return { ok: true, id: cat.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

// ── Update (rename + reparent) ─────────────────────────────────────────────

export async function updateCategoryAction(
  id: string,
  input: { name: string; parentId?: string | null }
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireAdmin();
    const parsed = categorySchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid" };
    }

    if (parsed.data.parentId === id) {
      return { ok: false, error: "A category cannot be its own parent" };
    }

    // Detect cycles: parentId must not be a descendant of id
    if (parsed.data.parentId) {
      const isDescendant = await isInSubtree(parsed.data.parentId, id);
      if (isDescendant) {
        return { ok: false, error: "Cannot reparent under one of its own descendants" };
      }
    }

    await prisma.category.update({
      where: { id },
      data: {
        name: parsed.data.name.trim(),
        parentId: parsed.data.parentId || null,
      },
    });
    revalidatePath("/admin/categories");
    revalidatePath("/products");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

// ── Delete (block if has products, optional reassign) ──────────────────────

export async function deleteCategoryAction(
  id: string,
  reassignToId?: string | null
): Promise<{ ok: true } | { ok: false; error: string; productCount?: number; childCount?: number }> {
  try {
    await requireAdmin();

    const [productCount, childCount] = await Promise.all([
      prisma.product.count({ where: { categoryId: id } }),
      prisma.category.count({ where: { parentId: id } }),
    ]);

    if (productCount > 0 && !reassignToId) {
      return {
        ok: false,
        error: `Category has ${productCount} product${productCount !== 1 ? "s" : ""}. Reassign them first or pick a target.`,
        productCount,
      };
    }
    if (childCount > 0) {
      return {
        ok: false,
        error: `Category has ${childCount} child categor${childCount !== 1 ? "ies" : "y"}. Delete or reparent them first.`,
        childCount,
      };
    }

    if (reassignToId === id) {
      return { ok: false, error: "Cannot reassign products to the same category" };
    }

    await prisma.$transaction(async (tx) => {
      if (reassignToId && productCount > 0) {
        // Verify target exists
        const target = await tx.category.findUnique({ where: { id: reassignToId } });
        if (!target) throw new Error("Reassignment target not found");
        await tx.product.updateMany({
          where: { categoryId: id },
          data: { categoryId: reassignToId },
        });
      }
      await tx.category.delete({ where: { id } });
    });

    revalidatePath("/admin/categories");
    revalidatePath("/products");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Is `candidate` inside the subtree rooted at `rootId`? (cycle prevention) */
async function isInSubtree(candidate: string, rootId: string): Promise<boolean> {
  const all = await prisma.category.findMany({
    select: { id: true, parentId: true },
  });
  const childMap = new Map<string, string[]>();
  for (const c of all) {
    if (c.parentId) {
      const arr = childMap.get(c.parentId) ?? [];
      arr.push(c.id);
      childMap.set(c.parentId, arr);
    }
  }
  const stack = [rootId];
  const seen = new Set<string>();
  while (stack.length) {
    const cur = stack.pop()!;
    if (seen.has(cur)) continue;
    seen.add(cur);
    if (cur === candidate) return true;
    for (const child of childMap.get(cur) ?? []) stack.push(child);
  }
  return false;
}
