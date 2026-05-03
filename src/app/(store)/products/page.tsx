import { Suspense } from "react";
import { Metadata } from "next";
import {
  getProducts,
  getBrands,
  getCategories,
} from "@/lib/data/products";
import { logSearchEvent } from "@/lib/actions/analytics";
import { ProductCard } from "./_components/product-card";
import { SearchBar } from "./_components/search-bar";
import { ProductFilters } from "./_components/product-filters";
import { Pagination } from "./_components/pagination";
import type { ProductSearchParams } from "@/lib/data/products";

export const metadata: Metadata = { title: "Parts Catalog" };
export const dynamic = "force-dynamic"; // don't cache — search events must fire every request

interface PageProps {
  searchParams: Promise<{
    q?: string;
    type?: string;
    category?: string;
    brand?: string;
    inStock?: string;
    sort?: string;
    page?: string;
  }>;
}

export default async function ProductsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const q      = params.q?.trim()   ?? "";
  const type   = params.type === "sku" ? "sku" : "name";
  const inStock = params.inStock === "1";
  const page   = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const sort   = (params.sort ?? "name_asc") as ProductSearchParams["sort"];

  const searchArgs: ProductSearchParams = {
    q:        q || undefined,
    type,
    category: params.category || undefined,
    brand:    params.brand    || undefined,
    inStock:  inStock || undefined,
    sort,
    page,
  };

  const [{ products, total, totalPages }, categories, brands] =
    await Promise.all([
      getProducts(searchArgs),
      getCategories(),
      getBrands(),
    ]);

  // Log every search (including zero results). We await because we need the
  // event ID to thread through as `?se=<id>` on product card links for
  // click-through attribution. Failure is swallowed inside logSearchEvent.
  const searchEventId = q
    ? await logSearchEvent({ query: q, searchType: type, resultCount: total })
    : null;

  return (
    <div className="space-y-6">
      {/* Page title + search */}
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Parts Catalog</h1>
        <Suspense>
          <SearchBar defaultQuery={q} defaultType={type} />
        </Suspense>
      </div>

      {/* Active search context */}
      {q && (
        <p className="text-sm text-muted-foreground">
          {total === 0 ? (
            <span className="text-orange-600 font-medium">
              No results for &ldquo;{q}&rdquo; — try a different search term or check the spelling.
            </span>
          ) : (
            <>
              Showing <strong>{total}</strong> result{total !== 1 ? "s" : ""} for{" "}
              &ldquo;<strong>{q}</strong>&rdquo;{" "}
              <span className="text-xs">({type === "sku" ? "by SKU" : "by name"})</span>
            </>
          )}
        </p>
      )}

      <div className="flex gap-6">
        {/* Filters sidebar */}
        <div className="hidden lg:block w-52 shrink-0">
          <Suspense>
            <ProductFilters
              categories={categories}
              brands={brands}
              currentCategory={params.category}
              currentBrand={params.brand}
              currentInStock={inStock}
              currentSort={sort}
            />
          </Suspense>
        </div>

        {/* Product grid */}
        <div className="flex-1 min-w-0">
          {products.length === 0 ? (
            <EmptyState hasQuery={!!q} />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    searchEventId={searchEventId}
                  />
                ))}
              </div>
              <Suspense>
                <Pagination page={page} totalPages={totalPages} total={total} />
              </Suspense>
            </>
          )}
        </div>
      </div>

      {/* Mobile filter summary */}
      {(params.category || params.brand || inStock) && (
        <div className="lg:hidden text-sm text-muted-foreground flex flex-wrap gap-2">
          <span>Filters:</span>
          {params.category && <FilterTag label={`Category: ${params.category}`} />}
          {params.brand    && <FilterTag label={`Brand: ${params.brand}`} />}
          {inStock         && <FilterTag label="In stock only" />}
        </div>
      )}
    </div>
  );
}

function EmptyState({ hasQuery }: { hasQuery: boolean }) {
  return (
    <div className="text-center py-16 text-muted-foreground">
      <p className="text-lg font-medium mb-1">
        {hasQuery ? "No matching parts found" : "No products yet"}
      </p>
      <p className="text-sm">
        {hasQuery
          ? "Try adjusting your search or filters."
          : "Check back soon — the catalog is being updated."}
      </p>
    </div>
  );
}

function FilterTag({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{label}</span>
  );
}

