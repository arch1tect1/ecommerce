import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Package,
  ChevronRight,
  Tag,
  Boxes,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { getProductById } from "@/lib/data/products";
import { logProductView, recordSearchClick } from "@/lib/actions/analytics";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
// Button kept for "Back to catalog" link
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { ImageGallery } from "./_image-gallery";
import { AddToCartButton } from "./add-to-cart-button";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ se?: string }>;
}

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductById(id);
  if (!product) return { title: "Product not found" };
  return {
    title: product.name,
    description: product.description ?? `${product.brand ?? ""} ${product.name} — ${product.sku}`,
  };
}

export default async function ProductDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { se } = await searchParams;
  const product = await getProductById(id);

  if (!product) notFound();

  // Fire-and-forget analytics — don't block render
  logProductView(product.id).catch(() => {});
  if (se) recordSearchClick(se, product.id).catch(() => {});

  const inStock = product.stock > 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/products" className="hover:text-foreground transition-colors">
          Catalog
        </Link>
        {product.category && (
          <>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link
              href={`/products?category=${product.category.slug}`}
              className="hover:text-foreground transition-colors"
            >
              {product.category.name}
            </Link>
          </>
        )}
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium truncate">{product.name}</span>
      </nav>

      {/* Main content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left — Image gallery */}
        <div>
          {product.images.length > 0 ? (
            <ImageGallery images={product.images} productName={product.name} />
          ) : (
            <div className="aspect-square rounded-lg border bg-gray-50 flex items-center justify-center">
              <Package className="h-24 w-24 text-gray-200" />
            </div>
          )}
        </div>

        {/* Right — Info */}
        <div className="space-y-5">
          {/* Brand + category */}
          <div className="flex flex-wrap gap-2">
            {product.brand && (
              <Badge variant="secondary">
                <ShieldCheck className="h-3 w-3 mr-1" />
                {product.brand}
              </Badge>
            )}
            {product.category && (
              <Badge variant="outline">
                <Tag className="h-3 w-3 mr-1" />
                {product.category.name}
              </Badge>
            )}
          </div>

          {/* Name */}
          <h1 className="text-2xl font-bold leading-snug">{product.name}</h1>

          {/* SKU */}
          <p className="text-sm text-muted-foreground font-mono">
            Article / SKU:{" "}
            <span className="text-foreground font-semibold">{product.sku}</span>
          </p>

          <Separator />

          {/* Price */}
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">
              {formatCurrency(product.price)}
            </span>
            <span className="text-sm text-muted-foreground">per unit</span>
          </div>

          {/* Stock */}
          <div className="flex items-center gap-2">
            <Boxes className="h-4 w-4 text-muted-foreground" />
            {inStock ? (
              <span className="text-green-600 font-medium text-sm">
                In stock — {product.stock} unit{product.stock !== 1 ? "s" : ""} available
              </span>
            ) : (
              <span className="text-red-500 font-medium text-sm flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                Out of stock
              </span>
            )}
          </div>

          {/* Add to cart */}
          <div className="pt-2">
            <AddToCartButton productId={product.id} stock={product.stock} />
          </div>
        </div>
      </div>

      {/* Description */}
      {product.description && (
        <Card>
          <CardContent className="pt-5">
            <h2 className="font-semibold mb-3">Description</h2>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {product.description}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Specs table */}
      <Card>
        <CardContent className="pt-5">
          <h2 className="font-semibold mb-3">Specifications</h2>
          <dl className="divide-y text-sm">
            <SpecRow label="SKU / Article" value={product.sku} />
            {product.brand    && <SpecRow label="Brand"    value={product.brand} />}
            {product.category && <SpecRow label="Category" value={product.category.name} />}
            <SpecRow
              label="Availability"
              value={
                inStock
                  ? `In stock (${product.stock} units)`
                  : "Out of stock"
              }
            />
            <SpecRow label="Price" value={formatCurrency(product.price)} />
          </dl>
        </CardContent>
      </Card>

      {/* Back link */}
      <div>
        <Button variant="ghost" asChild>
          <Link href="/products">← Back to catalog</Link>
        </Button>
      </div>
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
