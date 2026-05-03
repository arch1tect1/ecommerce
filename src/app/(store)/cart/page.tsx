import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCart } from "@/lib/data/cart";
import { serializeCartItem } from "@/lib/serialize";
import { Button } from "@/components/ui/button";
import { CartItems } from "./cart-items";

export const metadata: Metadata = { title: "Cart" };
export const dynamic = "force-dynamic";

export default async function CartPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Fetch cart + fresh customerId in parallel.
  // We DON'T trust session.user.customerId here because it's stored in the
  // JWT and can be stale if the user was linked to a customer after login
  // (e.g. admin linked themselves on /admin/users this session).
  const [cart, freshUser] = await Promise.all([
    getCart(session.user.id),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { customerId: true },
    }),
  ]);

  const items = (cart?.items ?? []).map(serializeCartItem);

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <ShoppingCart className="h-16 w-16 text-gray-200 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Your cart is empty</h1>
        <p className="text-muted-foreground mb-6">
          Browse the catalog and add items to get started.
        </p>
        <Button asChild>
          <Link href="/products">Browse catalog</Link>
        </Button>
      </div>
    );
  }

  const isLinked = !!freshUser?.customerId;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Your Cart</h1>
      <CartItems items={items} isLinked={isLinked} />
    </div>
  );
}
