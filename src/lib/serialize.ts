/**
 * Serialization helpers for the Server → Client Component boundary.
 *
 * Next.js forbids passing non-plain objects (Prisma Decimal, Date, BigInt…)
 * across that boundary. All monetary Decimal fields are serialized to `string`
 * (full precision preserved — pass to `new Decimal(value)` on the client).
 * Date fields are serialized to ISO 8601 strings.
 */

import type { CartItemWithProduct } from "@/lib/data/cart";
import type { OrderListItem } from "@/lib/data/orders";
import type { ProductListItem } from "@/lib/data/products";

// ── Primitive converters ───────────────────────────────────────────────────

/** Convert any Prisma Decimal (or number/string) to a plain string. */
export function decimalToStr(value: { toString(): string } | null | undefined): string {
  return value?.toString() ?? "0";
}

/** Convert a Date to an ISO string; returns null for null/undefined. */
export function dateToStr(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

// ── Cart ───────────────────────────────────────────────────────────────────

export interface SerializedCartItem {
  id: string;
  cartId: string;
  productId: string;
  quantity: number;
  /** Decimal serialized to string — use `new Decimal(priceSnapshot)` on client */
  priceSnapshot: string;
  product: {
    id: string;
    sku: string;
    name: string;
    brand: string | null;
    /** Decimal serialized to string */
    price: string;
    stock: number;
    isActive: boolean;
    images: { url: string }[];
  };
}

export function serializeCartItem(item: CartItemWithProduct): SerializedCartItem {
  return {
    id: item.id,
    cartId: item.cartId,
    productId: item.productId,
    quantity: item.quantity,
    priceSnapshot: decimalToStr(item.priceSnapshot),
    product: {
      id: item.product.id,
      sku: item.product.sku,
      name: item.product.name,
      brand: item.product.brand,
      price: decimalToStr(item.product.price),
      stock: item.product.stock,
      isActive: item.product.isActive,
      images: item.product.images,
    },
  };
}

// ── Order list item ────────────────────────────────────────────────────────

export interface SerializedOrderListItem {
  id: string;
  orderNumber: string;
  status: OrderListItem["status"];
  paymentStatus: OrderListItem["paymentStatus"];
  total: string;
  paid: string;
  createdAt: string;
  _count: { items: number };
}

export function serializeOrderListItem(order: OrderListItem): SerializedOrderListItem {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    total: decimalToStr(order.total),
    paid: decimalToStr(order.paid),
    createdAt: order.createdAt.toISOString(),
    _count: order._count,
  };
}

// ── Product list item ──────────────────────────────────────────────────────

export interface SerializedProductListItem {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  price: string;
  stock: number;
  categoryId: string | null;
  category: { name: string; slug: string } | null;
  images: { url: string }[];
}

export function serializeProductListItem(p: ProductListItem): SerializedProductListItem {
  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    brand: p.brand,
    price: decimalToStr(p.price),
    stock: p.stock,
    categoryId: p.categoryId,
    category: p.category ?? null,
    images: p.images,
  };
}
