import { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductForm } from "../_components/product-form";

export const metadata: Metadata = { title: "New product — Admin" };

export default async function NewProductPage() {
  const categories = await prisma.category.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/admin/products" className="hover:text-foreground">Products</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">New</span>
      </nav>

      <div>
        <h1 className="text-2xl font-bold">Add product</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manually create a product. After saving, you can upload images and they will appear in the catalog.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductForm mode="create" categories={categories} />
        </CardContent>
      </Card>
    </div>
  );
}
