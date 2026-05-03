"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { put, del } from "@vercel/blob";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "MANAGER")) {
    throw new Error("Unauthorized");
  }
  return session;
}

// ── Schemas ────────────────────────────────────────────────────────────────

const productCoreSchema = z.object({
  name: z.string().min(1, "Name is required").max(300),
  description: z.string().max(5000).optional().or(z.literal("")),
  brand: z.string().max(100).optional().or(z.literal("")),
  categoryId: z.string().optional().or(z.literal("")),
  price: z.coerce.number().min(0),
  stock: z.coerce.number().int().min(0),
  isActive: z.boolean().default(true),
});

const createProductSchema = productCoreSchema.extend({
  sku: z.string().min(1, "SKU is required").max(100),
  externalId: z.string().max(100).optional().or(z.literal("")),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof productCoreSchema>;

// ── Create product (manual entry only — externalId blank → local-<cuid>) ───

export async function createProductAction(
  input: CreateProductInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    await requireAdmin();
    const parsed = createProductSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid data" };
    }
    const { name, description, brand, categoryId, price, stock, isActive, sku, externalId } = parsed.data;

    const finalExternalId = externalId?.trim() || `local-${cuid()}`;

    // Reject collisions on sku or externalId early for a nice message
    const conflict = await prisma.product.findFirst({
      where: { OR: [{ sku }, { externalId: finalExternalId }] },
      select: { sku: true, externalId: true },
    });
    if (conflict) {
      return {
        ok: false,
        error: conflict.sku === sku
          ? `SKU "${sku}" already exists`
          : `External ID "${finalExternalId}" already exists`,
      };
    }

    const product = await prisma.product.create({
      data: {
        sku,
        externalId: finalExternalId,
        name,
        description: description?.trim() || null,
        brand: brand?.trim() || null,
        categoryId: categoryId || null,
        price,
        stock,
        isActive,
      },
      select: { id: true },
    });

    revalidatePath("/admin/products");
    return { ok: true, id: product.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to create" };
  }
}

// ── Update product (sku/externalId locked — synced from 1C) ────────────────

export async function updateProductAction(
  id: string,
  input: UpdateProductInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireAdmin();
    const parsed = productCoreSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid data" };
    }
    const { name, description, brand, categoryId, price, stock, isActive } = parsed.data;

    await prisma.product.update({
      where: { id },
      data: {
        name,
        description: description?.trim() || null,
        brand: brand?.trim() || null,
        categoryId: categoryId || null,
        price,
        stock,
        isActive,
      },
    });

    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${id}`);
    revalidatePath(`/products/${id}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update" };
  }
}

// ── Soft-deactivate / reactivate ───────────────────────────────────────────

export async function setProductActiveAction(
  id: string,
  isActive: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireAdmin();
    await prisma.product.update({ where: { id }, data: { isActive } });
    revalidatePath("/admin/products");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

// ── Image upload (Vercel Blob) ─────────────────────────────────────────────

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

export async function uploadProductImageAction(
  productId: string,
  formData: FormData
): Promise<{ ok: true; url: string; imageId: string } | { ok: false; error: string }> {
  try {
    await requireAdmin();

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return { ok: false, error: "No file provided" };
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return { ok: false, error: "Only JPEG, PNG, WebP, or GIF images allowed" };
    }
    if (file.size > MAX_IMAGE_SIZE) {
      return { ok: false, error: "Image must be 5 MB or smaller" };
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN.includes("placeholder")) {
      return {
        ok: false,
        error: "BLOB_READ_WRITE_TOKEN is not configured. Get one at vercel.com/dashboard/stores → Blob.",
      };
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, sku: true, _count: { select: { images: true } } },
    });
    if (!product) return { ok: false, error: "Product not found" };

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const filename = `products/${product.sku}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const blob = await put(filename, file, {
      access: "public",
      addRandomSuffix: false,
    });

    const isFirstImage = product._count.images === 0;

    const image = await prisma.productImage.create({
      data: {
        productId,
        url: blob.url,
        isPrimary: isFirstImage,
        order: product._count.images,
      },
      select: { id: true },
    });

    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${productId}`);
    return { ok: true, url: blob.url, imageId: image.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Upload failed" };
  }
}

// ── Delete image ───────────────────────────────────────────────────────────

export async function deleteProductImageAction(
  imageId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireAdmin();

    const image = await prisma.productImage.findUnique({
      where: { id: imageId },
      select: { id: true, url: true, productId: true, isPrimary: true },
    });
    if (!image) return { ok: false, error: "Image not found" };

    // Best-effort delete from blob storage; ignore errors so DB stays consistent
    if (process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_READ_WRITE_TOKEN.includes("placeholder")) {
      try {
        await del(image.url);
      } catch {
        /* swallow */
      }
    }

    await prisma.productImage.delete({ where: { id: imageId } });

    // If we deleted the primary image, promote the next one
    if (image.isPrimary) {
      const next = await prisma.productImage.findFirst({
        where: { productId: image.productId },
        orderBy: { order: "asc" },
        select: { id: true },
      });
      if (next) {
        await prisma.productImage.update({
          where: { id: next.id },
          data: { isPrimary: true },
        });
      }
    }

    revalidatePath(`/admin/products/${image.productId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

// ── Set primary image ──────────────────────────────────────────────────────

export async function setPrimaryImageAction(
  imageId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireAdmin();
    const image = await prisma.productImage.findUnique({
      where: { id: imageId },
      select: { productId: true },
    });
    if (!image) return { ok: false, error: "Image not found" };

    await prisma.$transaction([
      prisma.productImage.updateMany({
        where: { productId: image.productId },
        data: { isPrimary: false },
      }),
      prisma.productImage.update({
        where: { id: imageId },
        data: { isPrimary: true },
      }),
    ]);

    revalidatePath(`/admin/products/${image.productId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

// ── Reorder images (drag-drop) ─────────────────────────────────────────────

export async function reorderProductImagesAction(
  productId: string,
  imageIdsInOrder: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireAdmin();
    await prisma.$transaction(
      imageIdsInOrder.map((imageId, idx) =>
        prisma.productImage.update({
          where: { id: imageId },
          data: { order: idx },
        })
      )
    );
    revalidatePath(`/admin/products/${productId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

// Simple random ID for the local-<id> externalId of manually-created products.
function cuid(): string {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10)
  );
}
