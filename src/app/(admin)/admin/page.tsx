import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingBag,
  Users,
  TrendingUp,
  Activity,
  Search,
  Eye,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { RevenueLineChart } from "@/components/charts/revenue-line-chart";
import { HorizontalBarChart } from "@/components/charts/horizontal-bar-chart";
import {
  getOverviewKpis,
  getRevenueSeries,
  getTopSearches,
  getTopViewedProducts,
  getZeroResultSearches,
  getLastSyncs,
} from "@/lib/data/analytics-queries";

export const metadata = { title: "Admin Overview" };
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [kpis, revenue, topSearches, topViews, zeroResults, syncs] =
    await Promise.all([
      getOverviewKpis(),
      getRevenueSeries(30),
      getTopSearches(30, 10),
      getTopViewedProducts(30, 10),
      getZeroResultSearches(30, 25),
      getLastSyncs(),
    ]);

  const kpiCards = [
    {
      label: "Today's Orders",
      icon: ShoppingBag,
      value: String(kpis.ordersToday),
    },
    {
      label: "Revenue Today",
      icon: TrendingUp,
      value: formatCurrency(kpis.revenueToday),
    },
    {
      label: "New Users Today",
      icon: Users,
      value: String(kpis.newUsersToday),
    },
    {
      label: "Active Users (24h)",
      icon: Activity,
      value: String(kpis.activeUsers24h),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Overview</h1>
          <p className="mt-1 text-muted-foreground">
            Real-time KPIs and analytics across the last 30 days.
          </p>
        </div>
        <Link
          href="/admin/analytics"
          className="text-sm text-blue-600 hover:underline"
        >
          Open analytics →
        </Link>
      </div>

      {/* KPI cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpiCards.map(({ label, icon: Icon, value }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {label}
              </CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue chart ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" /> Revenue — last 30 days
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RevenueLineChart data={revenue} />
        </CardContent>
      </Card>

      {/* Top searches + views ─────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="h-4 w-4" /> Top searches (30d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <HorizontalBarChart
              data={topSearches.map((s) => ({ label: s.query, value: s.count }))}
              color="#2563eb"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Eye className="h-4 w-4" /> Most-viewed products (30d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <HorizontalBarChart
              data={topViews.map((p) => ({
                label: `${p.sku} — ${p.name}`,
                value: p.views,
              }))}
              color="#16a34a"
            />
          </CardContent>
        </Card>
      </div>

      {/* Zero-result searches + sync status ──────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="h-4 w-4" /> Zero-result searches (30d)
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Catalog gaps — queries that returned no products.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {zeroResults.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">
                No zero-result searches in the last 30 days.
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2">Query</th>
                      <th className="px-4 py-2 text-right">Searches</th>
                      <th className="px-4 py-2 text-right">Last seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {zeroResults.map((row) => (
                      <tr key={row.normalizedQuery} className="border-t">
                        <td className="px-4 py-2 font-mono text-xs">
                          {row.normalizedQuery}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {row.count}
                        </td>
                        <td className="px-4 py-2 text-right text-xs text-muted-foreground">
                          {formatDateTime(row.lastSearched)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RefreshCw className="h-4 w-4" /> Last sync status
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Latest run per sync type. Wiring up in Phase 8.
            </p>
          </CardHeader>
          <CardContent>
            {syncs.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                No syncs yet.
              </div>
            ) : (
              <div className="space-y-3">
                {syncs.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <div>
                      <div className="text-sm font-medium">{s.syncType}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateTime(s.startedAt)} ·{" "}
                        {s.recordsProcessed} processed, {s.recordsFailed} failed
                      </div>
                    </div>
                    <Badge
                      variant={
                        s.status === "SUCCESS"
                          ? "default"
                          : s.status === "FAILED"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {s.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
