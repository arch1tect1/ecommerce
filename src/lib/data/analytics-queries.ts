import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// ── Date helpers ───────────────────────────────────────────────────────────

export function startOfToday(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Parse a from/to date range from URL params (YYYY-MM-DD).
 * Falls back to "last `defaultDays` days" inclusive of today.
 */
export function parseRange(
  from: string | undefined,
  to: string | undefined,
  defaultDays: number = 30
): { from: Date; to: Date } {
  const now = new Date();
  const today = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      23,
      59,
      59,
      999
    )
  );
  const def = new Date(today.getTime() - (defaultDays - 1) * 24 * 60 * 60 * 1000);
  def.setUTCHours(0, 0, 0, 0);

  const fromDate = from ? new Date(`${from}T00:00:00Z`) : def;
  const toDate = to ? new Date(`${to}T23:59:59.999Z`) : today;
  return { from: fromDate, to: toDate };
}

// ── Overview KPIs ──────────────────────────────────────────────────────────

export async function getOverviewKpis() {
  const today = startOfToday();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

  const [
    ordersToday,
    revenueAgg,
    newUsersToday,
    activeUserSearches,
    activeUserViews,
  ] = await Promise.all([
    prisma.order.count({
      where: { createdAt: { gte: today } },
    }),
    prisma.order.aggregate({
      where: {
        createdAt: { gte: today },
        status: { not: "CANCELLED" },
      },
      _sum: { total: true },
    }),
    prisma.user.count({
      where: { createdAt: { gte: today } },
    }),
    prisma.searchEvent.findMany({
      where: { createdAt: { gte: yesterday }, userId: { not: null } },
      select: { userId: true },
      distinct: ["userId"],
    }),
    prisma.productView.findMany({
      where: { createdAt: { gte: yesterday }, userId: { not: null } },
      select: { userId: true },
      distinct: ["userId"],
    }),
  ]);

  const activeUserIds = new Set([
    ...activeUserSearches.map((s) => s.userId!).filter(Boolean),
    ...activeUserViews.map((v) => v.userId!).filter(Boolean),
  ]);

  return {
    ordersToday,
    revenueToday: revenueAgg._sum.total?.toString() ?? "0",
    newUsersToday,
    activeUsers24h: activeUserIds.size,
  };
}

// ── 30-day revenue series (one row per day) ────────────────────────────────

export interface RevenueDayPoint {
  date: string; // YYYY-MM-DD
  revenue: number;
  orders: number;
}

export async function getRevenueSeries(days: number = 30): Promise<RevenueDayPoint[]> {
  const since = daysAgo(days);

  // PostgreSQL date_trunc — Neon supports this natively.
  const rows = await prisma.$queryRaw<
    { day: Date; revenue: string | null; orders: bigint }[]
  >`
    SELECT
      date_trunc('day', "createdAt") AS day,
      COALESCE(SUM("total")::text, '0') AS revenue,
      COUNT(*) AS orders
    FROM "Order"
    WHERE "createdAt" >= ${since}
      AND "status" != 'CANCELLED'
    GROUP BY day
    ORDER BY day ASC
  `;

  // Build a complete date axis (so the chart shows zero days too)
  const out: RevenueDayPoint[] = [];
  const byDay = new Map(
    rows.map((r) => [
      formatYmd(r.day),
      { revenue: Number(r.revenue ?? 0), orders: Number(r.orders) },
    ])
  );
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const key = formatYmd(d);
    const entry = byDay.get(key) ?? { revenue: 0, orders: 0 };
    out.push({ date: key, ...entry });
  }
  return out;
}

function formatYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ── Top normalized search queries ──────────────────────────────────────────

export async function getTopSearches(days: number = 30, limit: number = 10) {
  const since = daysAgo(days);
  const rows = await prisma.searchEvent.groupBy({
    by: ["normalizedQuery"],
    where: { createdAt: { gte: since }, normalizedQuery: { not: "" } },
    _count: { _all: true },
    orderBy: { _count: { id: "desc" } },
    take: limit,
  });
  return rows.map((r) => ({
    query: r.normalizedQuery,
    count: r._count._all,
  }));
}

// ── Top viewed products ────────────────────────────────────────────────────

export async function getTopViewedProducts(days: number = 30, limit: number = 10) {
  const since = daysAgo(days);
  const grouped = await prisma.productView.groupBy({
    by: ["productId"],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
    orderBy: { _count: { id: "desc" } },
    take: limit,
  });
  if (grouped.length === 0) return [];
  const products = await prisma.product.findMany({
    where: { id: { in: grouped.map((g) => g.productId) } },
    select: { id: true, sku: true, name: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  return grouped.map((g) => ({
    productId: g.productId,
    sku: byId.get(g.productId)?.sku ?? "?",
    name: byId.get(g.productId)?.name ?? "(deleted)",
    views: g._count._all,
  }));
}

// ── Zero-result searches (catalog gaps) ────────────────────────────────────

export async function getZeroResultSearches(days: number = 30, limit: number = 25) {
  const since = daysAgo(days);
  const grouped = await prisma.searchEvent.groupBy({
    by: ["normalizedQuery"],
    where: {
      createdAt: { gte: since },
      resultCount: 0,
      normalizedQuery: { not: "" },
    },
    _count: { _all: true },
    _max: { createdAt: true, query: true },
    orderBy: { _count: { id: "desc" } },
    take: limit,
  });
  return grouped.map((g) => ({
    normalizedQuery: g.normalizedQuery,
    sampleQuery: g._max.query ?? g.normalizedQuery,
    count: g._count._all,
    lastSearched: g._max.createdAt ?? new Date(0),
  }));
}

// ── Last sync status (one row per syncType) ────────────────────────────────

export async function getLastSyncs() {
  // Latest row per syncType using DISTINCT ON
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      syncType: string;
      status: string;
      recordsProcessed: number;
      recordsFailed: number;
      startedAt: Date;
      finishedAt: Date | null;
    }>
  >`
    SELECT DISTINCT ON ("syncType")
      "id", "syncType", "status",
      "recordsProcessed", "recordsFailed",
      "startedAt", "finishedAt"
    FROM "SyncLog"
    ORDER BY "syncType", "startedAt" DESC
  `;
  return rows;
}

// ── /admin/analytics — Search analytics aggregated table ──────────────────

export interface SearchAnalyticsRow {
  normalizedQuery: string;
  sampleQuery: string;
  totalSearches: number;
  uniqueUsers: number;
  avgResults: number;
  clickThroughRate: number; // 0..1
  lastSearched: Date;
}

export async function getSearchAnalytics(opts: {
  from: Date;
  to: Date;
  limit?: number;
}): Promise<SearchAnalyticsRow[]> {
  const { from, to, limit = 200 } = opts;
  const rows = await prisma.$queryRaw<
    Array<{
      normalizedQuery: string;
      sample_query: string;
      total: bigint;
      unique_users: bigint;
      avg_results: number | string | null;
      clicks: bigint;
      last_searched: Date;
    }>
  >`
    SELECT
      "normalizedQuery",
      MAX("query") AS sample_query,
      COUNT(*) AS total,
      COUNT(DISTINCT "userId") AS unique_users,
      AVG("resultCount")::numeric(10,2) AS avg_results,
      COUNT(*) FILTER (WHERE "clickedProductId" IS NOT NULL) AS clicks,
      MAX("createdAt") AS last_searched
    FROM "SearchEvent"
    WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
      AND "normalizedQuery" != ''
    GROUP BY "normalizedQuery"
    ORDER BY total DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => {
    const total = Number(r.total);
    const clicks = Number(r.clicks);
    return {
      normalizedQuery: r.normalizedQuery,
      sampleQuery: r.sample_query,
      totalSearches: total,
      uniqueUsers: Number(r.unique_users),
      avgResults: Number(r.avg_results ?? 0),
      clickThroughRate: total > 0 ? clicks / total : 0,
      lastSearched: r.last_searched,
    };
  });
}

// ── /admin/analytics — Product views with conversion-to-cart ──────────────

export interface ProductViewsRow {
  productId: string;
  sku: string;
  name: string;
  isActive: boolean;
  views: number;
  uniqueViewers: number;
  inCartUsers: number;
  conversionRate: number; // 0..1
}

export async function getProductViewAnalytics(opts: {
  from: Date;
  to: Date;
  limit?: number;
}): Promise<ProductViewsRow[]> {
  const { from, to, limit = 100 } = opts;

  // 1) Aggregate views per product
  const grouped = await prisma.productView.groupBy({
    by: ["productId"],
    where: { createdAt: { gte: from, lte: to } },
    _count: { _all: true },
    orderBy: { _count: { id: "desc" } },
    take: limit,
  });
  if (grouped.length === 0) return [];

  const productIds = grouped.map((g) => g.productId);

  // 2) Distinct viewer count per product (logged-in only — anon viewers can't be deduped per user)
  const viewerRows = await prisma.$queryRaw<
    Array<{ productId: string; unique_viewers: bigint }>
  >(
    Prisma.sql`
      SELECT "productId", COUNT(DISTINCT "userId") AS unique_viewers
      FROM "ProductView"
      WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
        AND "userId" IS NOT NULL
        AND "productId" IN (${Prisma.join(productIds)})
      GROUP BY "productId"
    `
  );
  const uniqueViewersByProduct = new Map(
    viewerRows.map((r) => [r.productId, Number(r.unique_viewers)])
  );

  // 3) For conversion: count users who viewed AND have the product in any Cart right now.
  //    This is an approximation (we don't store CartItem timestamps), but useful as a
  //    directional metric. Anonymous viewers excluded because we can't link them to a cart.
  const cartRows = await prisma.$queryRaw<
    Array<{ productId: string; in_cart_users: bigint }>
  >(
    Prisma.sql`
      SELECT pv."productId", COUNT(DISTINCT pv."userId") AS in_cart_users
      FROM "ProductView" pv
      INNER JOIN "Cart" c     ON c."userId" = pv."userId"
      INNER JOIN "CartItem" ci ON ci."cartId" = c."id" AND ci."productId" = pv."productId"
      WHERE pv."createdAt" >= ${from} AND pv."createdAt" <= ${to}
        AND pv."userId" IS NOT NULL
        AND pv."productId" IN (${Prisma.join(productIds)})
      GROUP BY pv."productId"
    `
  );
  const inCartByProduct = new Map(cartRows.map((r) => [r.productId, Number(r.in_cart_users)]));

  // 4) Resolve product details
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, sku: true, name: true, isActive: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  return grouped.map((g) => {
    const product = byId.get(g.productId);
    const uniqueViewers = uniqueViewersByProduct.get(g.productId) ?? 0;
    const inCartUsers = inCartByProduct.get(g.productId) ?? 0;
    return {
      productId: g.productId,
      sku: product?.sku ?? "?",
      name: product?.name ?? "(deleted)",
      isActive: product?.isActive ?? false,
      views: g._count._all,
      uniqueViewers,
      inCartUsers,
      conversionRate: uniqueViewers > 0 ? inCartUsers / uniqueViewers : 0,
    };
  });
}

// ── /admin/analytics — Customer activity ──────────────────────────────────

export interface CustomerActivityRow {
  userId: string;
  fullName: string;
  email: string;
  customerId: string | null;
  customerName: string | null;
  searchCount: number;
  viewCount: number;
  lastActive: Date;
}

export async function getCustomerActivity(opts: {
  from: Date;
  to: Date;
  limit?: number;
}): Promise<CustomerActivityRow[]> {
  const { from, to, limit = 100 } = opts;

  const rows = await prisma.$queryRaw<
    Array<{
      userId: string;
      search_count: bigint;
      view_count: bigint;
      last_active: Date;
    }>
  >`
    WITH activity AS (
      SELECT "userId", "createdAt", 's' AS kind FROM "SearchEvent"
        WHERE "createdAt" >= ${from} AND "createdAt" <= ${to} AND "userId" IS NOT NULL
      UNION ALL
      SELECT "userId", "createdAt", 'v' AS kind FROM "ProductView"
        WHERE "createdAt" >= ${from} AND "createdAt" <= ${to} AND "userId" IS NOT NULL
    )
    SELECT
      "userId",
      COUNT(*) FILTER (WHERE kind = 's') AS search_count,
      COUNT(*) FILTER (WHERE kind = 'v') AS view_count,
      MAX("createdAt") AS last_active
    FROM activity
    GROUP BY "userId"
    ORDER BY last_active DESC
    LIMIT ${limit}
  `;
  if (rows.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: rows.map((r) => r.userId) } },
    select: {
      id: true, fullName: true, email: true,
      customerId: true,
      customer: { select: { name: true } },
    },
  });
  const byId = new Map(users.map((u) => [u.id, u]));

  return rows.map((r) => {
    const u = byId.get(r.userId);
    return {
      userId: r.userId,
      fullName: u?.fullName ?? "(unknown)",
      email: u?.email ?? "",
      customerId: u?.customerId ?? null,
      customerName: u?.customer?.name ?? null,
      searchCount: Number(r.search_count),
      viewCount: Number(r.view_count),
      lastActive: r.last_active,
    };
  });
}
