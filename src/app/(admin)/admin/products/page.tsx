import { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Plus, Package, Lock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency } from "@/lib/utils";
import { ProductsFilters } from "./_components/products-filters";
import { ToggleActiveButton } from "./_components/toggle-active-button";

export const metadata: Metadata = { title: "Products — Admin" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

interface PageProps {
  searchParams: Promise<{
    q?: string;
    category?: string;
    brand?: string;
    inStock?: string;
    status?: string;
    page?: string;
  }>;
}

export default async function AdminProductsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  // Build WHERE filter
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (sp.q?.trim()) {
    where.OR = [
      { sku:   { contains: sp.q.trim(), mode: "insensitive" } },
      { name:  { contains: sp.q.trim(), mode: "insensitive" } },
      { brand: { contains: sp.q.trim(), mode: "insensitive" } },
    ];
  }
  if (sp.category) where.category = { slug: sp.category };
  if (sp.brand) where.brand = sp.brand;
  if (sp.inStock === "1") where.stock = { gt: 0 };
  if (sp.status === "active")   where.isActive = true;
  if (sp.status === "inactive") where.isActive = false;

  const [products, total, categories, brands] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        sku: true,
        externalId: true,
        name: true,
        brand: true,
        price: true,
        stock: true,
        isActive: true,
        category: { select: { name: true } },
        images: {
          where: { isPrimary: true },
          take: 1,
          select: { url: true },
        },
      },
    }),
    prisma.product.count({ where }),
    prisma.category.findMany({
      where: { products: { some: {} } },
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: { brand: { not: null } },
      distinct: ["brand"],
      select: { brand: true },
      orderBy: { brand: "asc" },
    }).then((rs) => rs.map((r) => r.brand!)),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {total} product{total !== 1 ? "s" : ""} in catalog.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/products/new">
            <Plus className="h-4 w-4 mr-1.5" />
            Add product
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <ProductsFilters categories={categories} brands={brands} />

      {/* Table */}
      <div className="rounded-lg border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14"></TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-center">Stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-12">
                  No products match your filters.
                </TableCell>
              </TableRow>
            ) : (
              products.map((p) => {
                const isLocal = p.externalId.startsWith("local-");
                return (
                  <TableRow key={p.id} className={!p.isActive ? "opacity-60" : ""}>
                    <TableCell>
                      <div className="w-10 h-10 rounded border bg-gray-50 relative overflow-hidden">
                        {p.images[0]?.url ? (
                          <Image
                            src={p.images[0].url}
                            alt={p.name}
                            fill sizes="40px"
                            className="object-contain p-1"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <Package className="h-4 w-4 text-gray-300" />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      <span className="inline-flex items-center gap-1">
                        {!isLocal && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Lock className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>Synced from 1C</TooltipContent>
                          </Tooltip>
                        )}
                        {p.sku}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm font-medium max-w-[280px] truncate" title={p.name}>
                      {p.name}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.brand ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.category?.name ?? "—"}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(p.price)}
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={
                          p.stock === 0
                            ? "text-red-600 font-medium"
                            : p.stock < 10
                            ? "text-orange-600 font-medium"
                            : "text-green-700 font-medium"
                        }
                      >
                        {p.stock}
                      </span>
                    </TableCell>
                    <TableCell>
                      {p.isActive ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-gray-100 text-gray-600">
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/admin/products/${p.id}`}>Edit</Link>
                        </Button>
                        <ToggleActiveButton id={p.id} isActive={p.isActive} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/products?${buildPageHref(sp, page - 1)}`}>Previous</Link>
              </Button>
            )}
            {page < totalPages && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/products?${buildPageHref(sp, page + 1)}`}>Next</Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function buildPageHref(
  sp: Awaited<PageProps["searchParams"]>,
  newPage: number
): string {
  const params = new URLSearchParams();
  if (sp.q) params.set("q", sp.q);
  if (sp.category) params.set("category", sp.category);
  if (sp.brand) params.set("brand", sp.brand);
  if (sp.inStock) params.set("inStock", sp.inStock);
  if (sp.status) params.set("status", sp.status);
  params.set("page", String(newPage));
  return params.toString();
}
