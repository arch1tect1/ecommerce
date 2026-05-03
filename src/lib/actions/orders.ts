"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Decimal } from "decimal.js";

async function requireCustomer() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, customerId: true },
  });

  if (!user?.customerId) {
    return { error: "Your account is not yet linked to a customer record. Please contact us.", userId: user!.id, customerId: null };
  }
  return { userId: user.id, customerId: user.customerId, error: null };
}

// ── Sequential order number ────────────────────────────────────────────────
// Done inside the transaction that creates the order to avoid races.

async function nextOrderNumber(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
): Promise<string> {
  const result = await tx.$queryRaw<[{ max: string | null }]>`
    SELECT MAX("orderNumber") as max FROM "Order"
  `;
  const maxNum = result[0]?.max ? parseInt(result[0].max, 10) : 0;
  return String(maxNum + 1).padStart(10, "0");
}

// ── Create order from cart ─────────────────────────────────────────────────

export async function createOrderAction(): Promise<
  { ok: true; orderId: string } | { ok: false; error: string }
> {
  const { userId, customerId, error: authError } = await requireCustomer();
  if (authError || !customerId) {
    return { ok: false, error: authError ?? "Account not linked." };
  }

  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true, sku: true, name: true,
              price: true, stock: true, isActive: true,
            },
          },
        },
      },
    },
  });

  if (!cart || cart.items.length === 0) {
    return { ok: false, error: "Your cart is empty." };
  }

  // Validate stock before committing
  for (const item of cart.items) {
    if (!item.product.isActive) {
      return { ok: false, error: `"${item.product.name}" is no longer available.` };
    }
    if (item.product.stock < item.quantity) {
      return {
        ok: false,
        error: `"${item.product.name}" only has ${item.product.stock} unit(s) in stock (you have ${item.quantity} in cart).`,
      };
    }
  }

  // Calculate total using Decimal to avoid float errors
  const total = cart.items.reduce((sum, item) => {
    return sum.plus(new Decimal(item.priceSnapshot.toString()).times(item.quantity));
  }, new Decimal(0));

  const order = await prisma.$transaction(async (tx) => {
    const orderNumber = await nextOrderNumber(tx);

    const created = await tx.order.create({
      data: {
        orderNumber,
        customerId,
        total,
        items: {
          create: cart.items.map((item) => ({
            productId: item.productId,
            sku: item.product.sku,
            name: item.product.name,
            quantity: item.quantity,
            unitPrice: item.priceSnapshot,
            lineTotal: new Decimal(item.priceSnapshot.toString()).times(item.quantity),
          })),
        },
      },
    });

    // Clear cart inside the same transaction
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

    return created;
  });

  revalidatePath("/cart");
  revalidatePath("/orders");

  return { ok: true, orderId: order.id };
}

// ── Cancel / delete order ──────────────────────────────────────────────────

export async function cancelOrderAction(
  orderId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { customerId: true, role: true },
  });

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      // Admin/Manager can cancel any; Customer can only cancel their own
      ...(user?.role === "CUSTOMER"
        ? { customerId: user.customerId ?? "__none__" }
        : {}),
    },
    select: { id: true, status: true },
  });

  if (!order) return { ok: false, error: "Order not found." };
  if (order.status !== "PENDING") {
    return { ok: false, error: "Only PENDING orders can be cancelled." };
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { status: "CANCELLED" },
  });

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  return { ok: true };
}
