"use server";

import { prisma } from "@/lib/prisma";
import { normalizeQuery } from "@/lib/utils";
import { auth } from "@/auth";

// ── Log a search event ─────────────────────────────────────────────────────
// Called from the product list Server Component on every search request,
// including zero-result searches. Returns the inserted event ID so callers
// can thread it through to the product cards as `?se=<id>` for click-through
// attribution. If insert fails, returns null — never throw to the caller.

export async function logSearchEvent({
  query,
  searchType,
  resultCount,
}: {
  query: string;
  searchType: "sku" | "name";
  resultCount: number;
}): Promise<string | null> {
  try {
    const session = await auth();
    const userId = session?.user?.id ?? null;

    const event = await prisma.searchEvent.create({
      data: {
        userId,
        query,
        normalizedQuery: normalizeQuery(query),
        searchType,
        resultCount,
      },
      select: { id: true },
    });
    return event.id;
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("[analytics] logSearchEvent failed:", e);
    }
    return null;
  }
}

// ── Attribute a product click to a SearchEvent ─────────────────────────────
// Fire-and-forget. Only updates if:
//   - the id looks like a cuid
//   - the event has no clicked product yet (first click wins)

const CUID_RE = /^c[a-z0-9]{24}$/;

export async function recordSearchClick(
  searchEventId: string,
  productId: string
): Promise<void> {
  try {
    if (!CUID_RE.test(searchEventId)) return;

    await prisma.searchEvent.updateMany({
      where: {
        id: searchEventId,
        clickedProductId: null,
      },
      data: { clickedProductId: productId },
    });
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("[analytics] recordSearchClick failed:", e);
    }
  }
}

// ── Log a product view (deduped: max 1 per user per product per 60s) ──────
// Anonymous viewers (userId = null) are NOT deduped — every view is recorded.

export async function logProductView(productId: string): Promise<void> {
  try {
    const session = await auth();
    const userId = session?.user?.id ?? null;

    if (userId) {
      const recent = await prisma.productView.findFirst({
        where: {
          productId,
          userId,
          createdAt: { gte: new Date(Date.now() - 60_000) },
        },
        select: { id: true },
      });
      if (recent) return;
    }

    await prisma.productView.create({ data: { productId, userId } });
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("[analytics] logProductView failed:", e);
    }
  }
}
