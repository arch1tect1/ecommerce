import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getOrders } from "@/lib/data/orders";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/app/(store)/products/_components/pagination";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/order-status-badge";
import { CancelOrderButton } from "./cancel-order-button";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "My Orders" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function OrdersPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Read fresh from DB — the JWT may have a stale null customerId if the user
  // was linked to a customer after their current login session started.
  const freshUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { customerId: true },
  });
  const customerId = freshUser?.customerId;

  if (!customerId) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <ClipboardList className="h-16 w-16 text-gray-200 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">No orders yet</h1>
        <p className="text-muted-foreground mb-6">
          Your account is pending approval. Once linked to a customer record, your orders will appear here.
        </p>
        <Button asChild variant="outline">
          <Link href="/products">Browse catalog</Link>
        </Button>
      </div>
    );
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const { orders, total, totalPages } = await getOrders(customerId, { page });

  if (orders.length === 0 && page === 1) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <ClipboardList className="h-16 w-16 text-gray-200 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">No orders yet</h1>
        <p className="text-muted-foreground mb-6">
          Browse the catalog and place your first order.
        </p>
        <Button asChild>
          <Link href="/products">Browse catalog</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Orders</h1>
        <span className="text-sm text-muted-foreground">{total} order{total !== 1 ? "s" : ""}</span>
      </div>

      <div className="rounded-lg border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Order #</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                  {formatDateTime(order.createdAt)}
                </TableCell>
                <TableCell className="font-mono text-sm font-medium">
                  {order.orderNumber}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(order.total)}
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {formatCurrency(order.paid)}
                </TableCell>
                <TableCell>
                  <OrderStatusBadge status={order.status} />
                </TableCell>
                <TableCell>
                  <PaymentStatusBadge status={order.paymentStatus} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/orders/${order.id}`}>View</Link>
                    </Button>
                    {order.status === "PENDING" && (
                      <CancelOrderButton orderId={order.id} />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} />
    </div>
  );
}
