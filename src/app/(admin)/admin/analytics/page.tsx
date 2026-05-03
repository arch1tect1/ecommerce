import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getSearchAnalytics,
  getProductViewAnalytics,
  getCustomerActivity,
  parseRange,
} from "@/lib/data/analytics-queries";
import { DateRangeFilter } from "./_components/date-range-filter";
import { SearchAnalyticsTable } from "./_components/search-analytics-table";
import { ProductViewsTable } from "./_components/product-views-table";
import { CustomerActivityTable } from "./_components/customer-activity-table";

export const metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{
    from?: string;
    to?: string;
    tab?: string;
  }>;
}

export default async function AnalyticsPage({ searchParams }: Props) {
  const { from, to, tab } = await searchParams;
  const range = parseRange(from, to, 30);

  const [searches, views, customers] = await Promise.all([
    getSearchAnalytics({ from: range.from, to: range.to, limit: 200 }),
    getProductViewAnalytics({ from: range.from, to: range.to, limit: 100 }),
    getCustomerActivity({ from: range.from, to: range.to, limit: 100 }),
  ]);

  const csvParams = new URLSearchParams();
  if (from) csvParams.set("from", from);
  if (to) csvParams.set("to", to);
  const csvHref = `/api/admin/analytics/searches.csv?${csvParams.toString()}`;

  // Serialize Dates → strings for client components
  const searchRows = searches.map((s) => ({
    ...s,
    lastSearched: s.lastSearched.toISOString(),
  }));
  const customerRows = customers.map((c) => ({
    ...c,
    lastActive: c.lastActive.toISOString(),
  }));

  const initialTab = tab === "views" || tab === "customers" ? tab : "searches";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="mt-1 text-muted-foreground">
          Search behavior, product engagement, and customer activity.
        </p>
      </div>

      <DateRangeFilter defaultDays={30} />

      <Tabs defaultValue={initialTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="searches">Search analytics</TabsTrigger>
          <TabsTrigger value="views">Product views</TabsTrigger>
          <TabsTrigger value="customers">Customer activity</TabsTrigger>
        </TabsList>

        <TabsContent value="searches">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Search analytics</CardTitle>
              <p className="text-xs text-muted-foreground">
                Aggregated by normalized query.
              </p>
            </CardHeader>
            <CardContent>
              <SearchAnalyticsTable rows={searchRows} csvHref={csvHref} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="views">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Product views</CardTitle>
              <p className="text-xs text-muted-foreground">
                Top {views.length} most-viewed products with conversion-to-cart rate.
              </p>
            </CardHeader>
            <CardContent>
              <ProductViewsTable rows={views} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Customer activity</CardTitle>
              <p className="text-xs text-muted-foreground">
                Click a row to drill into the customer&apos;s activity timeline.
              </p>
            </CardHeader>
            <CardContent>
              <CustomerActivityTable rows={customerRows} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
