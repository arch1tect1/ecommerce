import { Package, Search, ShoppingBag, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-10">
      {/* Hero search bar */}
      <section className="rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 px-8 py-12 text-white text-center">
        <h1 className="text-3xl font-bold mb-2">
          {process.env.NEXT_PUBLIC_SITE_NAME ?? "AutoParts B2B"}
        </h1>
        <p className="text-blue-100 mb-6">
          Wholesale catalog — find parts by SKU or name
        </p>
        <form
          action="/products"
          method="GET"
          className="space-y-2 max-w-lg mx-auto"
        >
          <div className="flex gap-2">
            <input
              name="q"
              type="text"
              placeholder="Search by SKU or part name…"
              className="flex-1 rounded-md px-4 py-2.5 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-white"
            />
            <Button type="submit" variant="secondary" className="shrink-0">
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>
          <div className="flex gap-4 text-sm justify-center">
            {(["name", "sku"] as const).map((t) => (
              <label key={t} className="flex items-center gap-1.5 cursor-pointer text-blue-100 hover:text-white">
                <input type="radio" name="type" value={t} defaultChecked={t === "name"} className="accent-white" />
                {t === "name" ? "By name" : "By SKU / article"}
              </label>
            ))}
          </div>
        </form>
      </section>

      {/* Quick links */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              Browse Catalog
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Browse all available auto parts by category or brand.
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href="/products">View catalog →</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-green-600" />
              My Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Track and manage your order history.
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href="/orders">View orders →</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-600" />
              Account
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              View your balance, credit limit, and profile.
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href="/account">My account →</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Phase note */}
      <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
        <strong>Phase 1 complete.</strong> Foundation is set up. Auth, catalog,
        cart, and admin panels are coming in subsequent phases.
      </div>
    </div>
  );
}
