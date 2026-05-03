import { prisma } from "@/lib/prisma";

export const ORDERS_PER_PAGE = 20;

export type OrderListItem = Awaited<ReturnType<typeof getOrders>>["orders"][number];
export type OrderDetail   = NonNullable<Awaited<ReturnType<typeof getOrderById>>>;

export async function getOrders(
  customerId: string,
  { page = 1 }: { page?: number } = {}
) {
  const skip = (page - 1) * ORDERS_PER_PAGE;

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      skip,
      take: ORDERS_PER_PAGE,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        total: true,
        paid: true,
        createdAt: true,
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where: { customerId } }),
  ]);

  return {
    orders,
    total,
    page,
    totalPages: Math.ceil(total / ORDERS_PER_PAGE),
  };
}

export async function getOrderById(id: string, customerId?: string) {
  return prisma.order.findFirst({
    where: {
      id,
      ...(customerId ? { customerId } : {}),
    },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
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
      customer: {
        select: { name: true, phone: true, address: true },
      },
    },
  });
}
