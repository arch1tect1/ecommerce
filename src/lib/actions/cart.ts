"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// ── helpers ────────────────────────────────────────────────────────────────

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

async function getOrCreateCart(userId: string) {
  const existing = await prisma.cart.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.cart.create({ data: { userId } });
}

// ── Add / increment ────────────────────────────────────────────────────────

export async function addToCartAction(productId: string, quantity = 1) {
  const userId = await requireUser();

  const product = await prisma.product.findFirst({
    where: { id: productId, isActive: true },
    select: { id: true, stock: true, price: true, name: true },
  });

  if (!product) return { error: "Product not found." };
  if (product.stock === 0) return { error: "This item is out of stock." };

  const cart = await getOrCreateCart(userId);

  const existing = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId: cart.id, productId } },
  });

  const newQty = (existing?.quantity ?? 0) + quantity;
  const capped = Math.min(newQty, product.stock);

  await prisma.cartItem.upsert({
    where: { cartId_productId: { cartId: cart.id, productId } },
    update: { quantity: capped, priceSnapshot: product.price },
    create: {
      cartId: cart.id,
      productId,
      quantity: capped,
      priceSnapshot: product.price,
    },
  });

  revalidatePath("/cart");
  revalidatePath(`/products/${productId}`);
  return { ok: true };
}

// ── Update quantity (set exact value) ─────────────────────────────────────

export async function updateCartItemAction(cartItemId: string, quantity: number) {
  const userId = await requireUser();

  const item = await prisma.cartItem.findFirst({
    where: { id: cartItemId, cart: { userId } },
    include: { product: { select: { stock: true } } },
  });
  if (!item) return { error: "Cart item not found." };

  if (quantity <= 0) {
    await prisma.cartItem.delete({ where: { id: cartItemId } });
  } else {
    const capped = Math.min(quantity, item.product.stock);
    await prisma.cartItem.update({
      where: { id: cartItemId },
      data: { quantity: capped },
    });
  }

  revalidatePath("/cart");
  return { ok: true };
}

// ── Remove single item ─────────────────────────────────────────────────────

export async function removeCartItemAction(cartItemId: string) {
  const userId = await requireUser();
  await prisma.cartItem.deleteMany({
    where: { id: cartItemId, cart: { userId } },
  });
  revalidatePath("/cart");
}

// ── Clear entire cart ──────────────────────────────────────────────────────

export async function clearCartAction() {
  const userId = await requireUser();
  const cart = await prisma.cart.findUnique({ where: { userId } });
  if (cart) {
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  }
  revalidatePath("/cart");
}
