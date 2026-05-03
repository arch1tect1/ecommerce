import Link from "next/link";
import Image from "next/image";
import { Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { ProductListItem } from "@/lib/data/products";

interface ProductCardProps {
  product: ProductListItem;
  /** If this product was listed as part of a search, pass the SearchEvent ID
   *  so clicks can be attributed. Null/undefined when not a search result. */
  searchEventId?: string | null;
}

export function ProductCard({ product, searchEventId }: ProductCardProps) {
  const primaryImage = product.images[0]?.url ?? null;
  const inStock = product.stock > 0;
  const href = searchEventId
    ? `/products/${product.id}?se=${searchEventId}`
    : `/products/${product.id}`;

  return (
    <Card className="flex flex-col overflow-hidden hover:shadow-md transition-shadow group">
      {/* Image */}
      <div className="relative h-44 bg-gray-50 overflow-hidden">
        {primaryImage ? (
          <Image
            src={primaryImage}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 100vw, 33vw"
            className="object-contain p-3 group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-300">
            <Package className="h-16 w-16" />
          </div>
        )}

        {/* Out of stock overlay */}
        {!inStock && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide bg-white rounded px-2 py-1 shadow-sm">
              Out of stock
            </span>
          </div>
        )}
      </div>

      <CardContent className="flex-1 pt-3 pb-2 px-4 space-y-1.5">
        {/* Brand badge */}
        {product.brand && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {product.brand}
          </Badge>
        )}

        {/* Name */}
        <h3
          className="font-medium text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors"
          title={product.name}
        >
          {product.name}
        </h3>

        {/* SKU */}
        <p className="text-xs text-muted-foreground font-mono">
          Art: {product.sku}
        </p>

        {/* Stock indicator */}
        <p
          className={
            inStock
              ? "text-xs text-green-600 font-medium"
              : "text-xs text-red-500 font-medium"
          }
        >
          {inStock ? `In stock (${product.stock})` : "Out of stock"}
        </p>
      </CardContent>

      <CardFooter className="px-4 pb-4 flex items-center justify-between">
        <span className="font-bold text-base">
          {formatCurrency(product.price)}
        </span>
        <Button asChild size="sm" variant="outline">
          <Link href={href}>Details</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
