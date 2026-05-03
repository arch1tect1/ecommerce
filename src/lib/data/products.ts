import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const PRODUCTS_PER_PAGE = 12;

export interface ProductSearchParams {
  q?: string;
  type?: "sku" | "name";
  category?: string;   // slug
  brand?: string;
  inStock?: boolean;
  sort?: "name_asc" | "name_desc" | "price_asc" | "price_desc";
  page?: number;
}

export type ProductListItem = Awaited<ReturnType<typeof getProducts>>["products"][number];
export type ProductDetail  = NonNullable<Awaited<ReturnType<typeof getProductById>>>;

// ── Build WHERE clause ─────────────────────────────────────────────────────

function buildWhere(
  params: ProductSearchParams
): Prisma.ProductWhereInput {
  const { q, type = "name", category, brand, inStock } = params;

  const where: Prisma.ProductWhereInput = { isActive: true };

  if (inStock) where.stock = { gt: 0 };

  if (brand) where.brand = brand;

  if (category) {
    where.category = { slug: category };
  }

  if (q && q.trim()) {
    const term = q.trim();
    if (type === "sku") {
      where.sku = { contains: term, mode: "insensitive" };
    } else {
      where.OR = [
        { name: { contains: term, mode: "insensitive" } },
        { sku:  { contains: term, mode: "insensitive" } },
        { brand:{ contains: term, mode: "insensitive" } },
      ];
    }
  }

  return where;
}

// ── Get paginated product list ─────────────────────────────────────────────

export async function getProducts(params: ProductSearchParams) {
  const page = Math.max(1, params.page ?? 1);
  const skip = (page - 1) * PRODUCTS_PER_PAGE;

  const orderBy = buildOrderBy(params.sort);
  const where = buildWhere(params);

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy,
      skip,
      take: PRODUCTS_PER_PAGE,
      select: {
        id: true,
        sku: true,
        name: true,
        brand: true,
        price: true,
        stock: true,
        categoryId: true,
        category: { select: { name: true, slug: true } },
        images: {
          where: { isPrimary: true },
          take: 1,
          select: { url: true },
        },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return {
    products,
    total,
    page,
    totalPages: Math.ceil(total / PRODUCTS_PER_PAGE),
  };
}

// ── Get a single product with all detail ──────────────────────────────────

export async function getProductById(id: string) {
  return prisma.product.findFirst({
    where: { id, isActive: true },
    include: {
      category: { select: { name: true, slug: true } },
      images: { orderBy: [{ isPrimary: "desc" }, { order: "asc" }] },
    },
  });
}

// ── Get all brands (for filter) ────────────────────────────────────────────

export async function getBrands(): Promise<string[]> {
  const rows = await prisma.product.findMany({
    where: { isActive: true, brand: { not: null } },
    distinct: ["brand"],
    select: { brand: true },
    orderBy: { brand: "asc" },
  });
  return rows.map((r) => r.brand!);
}

// ── Get all categories ─────────────────────────────────────────────────────

export async function getCategories() {
  return prisma.category.findMany({
    where: { products: { some: { isActive: true } } },
    select: { id: true, name: true, slug: true, parentId: true },
    orderBy: { name: "asc" },
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────

function buildOrderBy(
  sort?: ProductSearchParams["sort"]
): Prisma.ProductOrderByWithRelationInput {
  switch (sort) {
    case "name_desc":  return { name: "desc" };
    case "price_asc":  return { price: "asc" };
    case "price_desc": return { price: "desc" };
    default:           return { name: "asc" };
  }
}
