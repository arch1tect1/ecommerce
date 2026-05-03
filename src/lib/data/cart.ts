import { prisma } from "@/lib/prisma";

export type CartWithItems = NonNullable<Awaited<ReturnType<typeof getCart>>>;
export type CartItemWithProduct = CartWithItems["items"][number];

export async function getCart(userId: string) {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              sku: true,
              name: true,
              brand: true,
              price: true,
              stock: true,
              isActive: true,
              images: {
                where: { isPrimary: true },
                take: 1,
                select: { url: true },
              },
            },
          },
        },
        orderBy: { id: "asc" },
      },
    },
  });

  return cart;
}

export async function getCartItemCount(userId: string): Promise<number> {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    select: {
      items: { select: { quantity: true } },
    },
  });
  if (!cart) return 0;
  return cart.items.reduce((sum, i) => sum + i.quantity, 0);
}
