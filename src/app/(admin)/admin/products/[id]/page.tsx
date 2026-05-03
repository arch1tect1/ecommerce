import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductForm } from "../_components/product-form";
import { ImageManager } from "../_components/image-manager";

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    select: { name: true },
  });
  return { title: product ? `${product.name} — Admin` : "Product not found" };
}

export default async function EditProductPage({ params }: Props) {
  const { id } = await params;

  const [product, categories] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { order: "asc" } },
      },
    }),
    prisma.category.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!product) notFound();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/admin/products" className="hover:text-foreground">Products</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium truncate">{product.name}</span>
      </nav>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{product.name}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            <span className="font-mono">{product.sku}</span>
            {" · "}
            <span className="font-mono text-xs">{product.externalId}</span>
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductForm
            mode="edit"
            categories={categories}
            initial={{
              id: product.id,
              sku: product.sku,
              externalId: product.externalId,
              name: product.name,
              description: product.description,
              brand: product.brand,
              categoryId: product.categoryId,
              price: product.price.toString(),
              stock: product.stock,
              isActive: product.isActive,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Images</CardTitle>
        </CardHeader>
        <CardContent>
          <ImageManager
            productId={product.id}
            images={product.images.map((img) => ({
              id: img.id,
              url: img.url,
              isPrimary: img.isPrimary,
              order: img.order,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
