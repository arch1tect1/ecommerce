import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { CategoriesTree } from "./categories-tree";

export const metadata: Metadata = { title: "Categories — Admin" };
export const dynamic = "force-dynamic";

export interface CategoryWithCounts {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  productCount: number;
}

export default async function AdminCategoriesPage() {
  const all = await prisma.category.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      parentId: true,
      _count: { select: { products: true } },
    },
  });

  const flattened: CategoryWithCounts[] = all.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    parentId: c.parentId,
    productCount: c._count.products,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Categories</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {flattened.length} categor{flattened.length !== 1 ? "ies" : "y"}.
          Drag is not enabled — use Edit to reparent.
        </p>
      </div>

      <CategoriesTree categories={flattened} />
    </div>
  );
}
