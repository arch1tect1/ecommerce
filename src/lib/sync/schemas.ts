import { z } from "zod";

// ─── Decimal coercion ──────────────────────────────────────────────────────
//
// 1C may send numeric fields as either string ("1234.56") or number.
// We accept both and validate >= 0, returning a normalized string with at
// most 2 decimal places. We never go through `Number` for storage — Prisma
// accepts the string directly into Decimal columns, preserving precision.

export const DecimalSchema = z
  .union([z.string(), z.number()])
  .transform((v, ctx) => {
    const s = typeof v === "number" ? v.toString() : v.trim();
    if (!/^-?\d+(\.\d+)?$/.test(s)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Not a valid decimal: ${v}`,
      });
      return z.NEVER;
    }
    const num = Number(s);
    if (!Number.isFinite(num)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Decimal out of range: ${v}`,
      });
      return z.NEVER;
    }
    if (num < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Decimal must be >= 0`,
      });
      return z.NEVER;
    }
    return s;
  });

const ExternalId = z.string().min(1).max(64);

// ─── Products ──────────────────────────────────────────────────────────────

export const ProductInputSchema = z.object({
  externalId: ExternalId,
  sku: z.string().min(1).max(64),
  name: z.string().min(1).max(500),
  description: z.string().max(10000).nullish(),
  brand: z.string().max(120).nullish(),
  categoryExternalId: z.string().max(64).nullish(),
  price: DecimalSchema,
  stock: z.number().int().min(0),
  isActive: z.boolean().optional(),
});
export type ProductInput = z.infer<typeof ProductInputSchema>;

export const ProductsPayloadSchema = z.object({
  products: z.array(ProductInputSchema).max(50_000),
  mode: z.enum(["full", "delta"]).default("delta"),
});
export type ProductsPayload = z.infer<typeof ProductsPayloadSchema>;

// ─── Stock (lightweight) ───────────────────────────────────────────────────

export const StockItemSchema = z.object({
  externalId: ExternalId,
  stock: z.number().int().min(0),
});
export const StockPayloadSchema = z.object({
  items: z.array(StockItemSchema).max(50_000),
});
export type StockPayload = z.infer<typeof StockPayloadSchema>;

// ─── Prices ────────────────────────────────────────────────────────────────

export const PriceItemSchema = z.object({
  externalId: ExternalId,
  price: DecimalSchema,
});
export const PricesPayloadSchema = z.object({
  items: z.array(PriceItemSchema).max(50_000),
});
export type PricesPayload = z.infer<typeof PricesPayloadSchema>;

// ─── Categories ────────────────────────────────────────────────────────────

export const CategoryInputSchema = z.object({
  externalId: ExternalId,
  name: z.string().min(1).max(200),
  parentExternalId: z.string().max(64).nullish(),
});
export const CategoriesPayloadSchema = z.object({
  categories: z.array(CategoryInputSchema).max(10_000),
});
export type CategoriesPayload = z.infer<typeof CategoriesPayloadSchema>;

// ─── Customers ─────────────────────────────────────────────────────────────

export const CustomerInputSchema = z.object({
  externalId: ExternalId,
  name: z.string().min(1).max(200),
  taxId: z.string().max(40).nullish(),
  phone: z.string().max(40).nullish(),
  address: z.string().max(500).nullish(),
  balance: DecimalSchema,
  creditLimit: DecimalSchema,
});
export const CustomersPayloadSchema = z.object({
  customers: z.array(CustomerInputSchema).max(50_000),
});
export type CustomersPayload = z.infer<typeof CustomersPayloadSchema>;

// ─── Result type returned by every core sync function ─────────────────────

export interface SyncResult {
  processed: number;
  failed: number;
  errors: Array<{ externalId?: string; error: string }>;
}

export const SYNC_TYPES = [
  "products",
  "stock",
  "prices",
  "categories",
  "customers",
] as const;
export type SyncType = (typeof SYNC_TYPES)[number];
