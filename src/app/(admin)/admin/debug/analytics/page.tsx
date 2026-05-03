import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import { Search, Eye } from "lucide-react";

export const metadata: Metadata = { title: "Analytics Debug — Admin" };
export const dynamic = "force-dynamic";

/**
 * Hidden in production unless ENABLE_DEBUG_PAGES=true. The page exposes raw
 * event rows and is useful during integration testing, but should never be
 * reachable in production by default.
 */
function debugPagesEnabled(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.ENABLE_DEBUG_PAGES === "true";
}

export default async function AnalyticsDebugPage() {
  if (!debugPagesEnabled()) {
    notFound();
  }
  const [searchEvents, productViews, totals] = await Promise.all([
    prisma.searchEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        query: true,
        normalizedQuery: true,
        searchType: true,
        resultCount: true,
        clickedProductId: true,
        createdAt: true,
        user: { select: { email: true, fullName: true } },
        // Join clicked product if present
      },
    }),
    prisma.productView.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        productId: true,
        createdAt: true,
        user: { select: { email: true, fullName: true } },
        product: { select: { sku: true, name: true } },
      },
    }),
    prisma.$transaction([
      prisma.searchEvent.count(),
      prisma.productView.count(),
      prisma.searchEvent.count({ where: { clickedProductId: { not: null } } }),
      prisma.searchEvent.count({ where: { resultCount: 0 } }),
    ]),
  ]);

  const [totalSearches, totalViews, totalClicks, zeroResultSearches] = totals;
  const clickThroughRate =
    totalSearches > 0 ? Math.round((totalClicks / totalSearches) * 100) : 0;

  // Fetch clicked product details in one query so we can show SKU + name
  const clickedIds = Array.from(
    new Set(
      searchEvents
        .map((e) => e.clickedProductId)
        .filter((v): v is string => !!v)
    )
  );
  const clickedProducts = clickedIds.length
    ? await prisma.product.findMany({
        where: { id: { in: clickedIds } },
        select: { id: true, sku: true, name: true },
      })
    : [];
  const productById = new Map(clickedProducts.map((p) => [p.id, p]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics Debug</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Raw event feed. Will be replaced by real dashboards in Phase 7.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total searches" value={totalSearches} />
        <StatCard label="Total views" value={totalViews} />
        <StatCard
          label="Search click-through"
          value={`${clickThroughRate}%`}
          sub={`${totalClicks} of ${totalSearches} clicked`}
        />
        <StatCard
          label="Zero-result searches"
          value={zeroResultSearches}
          highlight={zeroResultSearches > 0}
        />
      </div>

      {/* SearchEvents table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-4 w-4" />
            Latest 20 SearchEvents
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {searchEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6 text-center">
              No search events recorded yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Query</TableHead>
                  <TableHead>Normalized</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-center">Results</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Clicked</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {searchEvents.map((e) => {
                  const clicked = e.clickedProductId
                    ? productById.get(e.clickedProductId)
                    : null;
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDateTime(e.createdAt)}
                      </TableCell>
                      <TableCell className="font-mono text-sm max-w-[160px] truncate" title={e.query}>
                        &ldquo;{e.query}&rdquo;
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground max-w-[160px] truncate" title={e.normalizedQuery}>
                        {e.normalizedQuery}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {e.searchType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={
                            e.resultCount === 0
                              ? "text-orange-600 font-semibold"
                              : "font-medium"
                          }
                        >
                          {e.resultCount}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">
                        {e.user ? (
                          <span title={e.user.email}>{e.user.fullName}</span>
                        ) : (
                          <span className="text-muted-foreground italic">anonymous</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {clicked ? (
                          <Link
                            href={`/products/${e.clickedProductId}`}
                            className="text-primary hover:underline"
                            title={clicked.name}
                          >
                            {clicked.sku}
                          </Link>
                        ) : e.clickedProductId ? (
                          <span className="font-mono text-muted-foreground">
                            {e.clickedProductId.slice(0, 8)}…
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ProductViews table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Eye className="h-4 w-4" />
            Latest 20 ProductViews
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {productViews.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6 text-center">
              No product views recorded yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>User</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productViews.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(v.createdAt)}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      <Link
                        href={`/products/${v.productId}`}
                        className="text-primary hover:underline"
                      >
                        {v.product.sku}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm max-w-[320px] truncate" title={v.product.name}>
                      {v.product.name}
                    </TableCell>
                    <TableCell className="text-xs">
                      {v.user ? (
                        <span title={v.user.email}>{v.user.fullName}</span>
                      ) : (
                        <span className="text-muted-foreground italic">anonymous</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  highlight = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={`text-2xl font-bold ${highlight ? "text-orange-600" : ""}`}
        >
          {value}
        </div>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}
