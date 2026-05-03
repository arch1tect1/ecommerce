import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ChevronRight, Package } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getOrderById } from "@/lib/data/orders";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/order-status-badge";
import { CancelOrderButton } from "../cancel-order-button";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Decimal } from "decimal.js";

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return { title: "Order" };
  // Admin/Manager can view any order; customer filtered by their own — but
  // we need the fresh customerId from DB since the JWT can be stale.
  const isStaff = session.user.role === "ADMIN" || session.user.role === "MANAGER";
  let filter: string | undefined;
  if (!isStaff) {
    const u = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { customerId: true },
    });
    filter = u?.customerId ?? undefined;
  }
  const order = await getOrderById(id, filter);
  if (!order) return { title: "Order not found" };
  return { title: `Order ${order.orderNumber}` };
}

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Admins/managers see any order; customers only see their own.
  // Fresh DB read because the JWT's customerId can be stale after a recent link.
  const isStaff = session.user.role === "ADMIN" || session.user.role === "MANAGER";
  let filterByCustomer: string | undefined;
  if (!isStaff) {
    const u = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { customerId: true },
    });
    filterByCustomer = u?.customerId ?? undefined;
  }

  const order = await getOrderById(id, filterByCustomer);
  if (!order) notFound();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/orders" className="hover:text-foreground">My Orders</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-mono font-medium">{order.orderNumber}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Order {order.orderNumber}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Placed {formatDateTime(order.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <OrderStatusBadge status={order.status} />
          <PaymentStatusBadge status={order.paymentStatus} />
          {order.status === "PENDING" && (
            <CancelOrderButton orderId={order.id} />
          )}
        </div>
      </div>

      {/* Items */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Items ({order.items.reduce((s, i) => s + i.quantity, 0)} units)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Product</TableHead>
                <TableHead className="text-center">Qty</TableHead>
                <TableHead className="text-right">Unit price</TableHead>
                <TableHead className="text-right pr-6">Line total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="pl-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded border bg-gray-50 shrink-0 relative overflow-hidden">
                        {item.product.images[0]?.url ? (
                          <Image
                            src={item.product.images[0].url}
                            alt={item.name}
                            fill sizes="40px"
                            className="object-contain p-1"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <Package className="h-4 w-4 text-gray-300" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{item.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{item.sku}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-sm">{item.quantity}</TableCell>
                  <TableCell className="text-right text-sm">{formatCurrency(item.unitPrice)}</TableCell>
                  <TableCell className="text-right font-semibold text-sm pr-6">
                    {formatCurrency(item.lineTotal)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-72 space-y-2 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatCurrency(order.total)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Paid</span>
            <span className="text-green-600">{formatCurrency(order.paid)}</span>
          </div>
          <Separator />
          <div className="flex justify-between font-bold text-base">
            <span>Balance due</span>
            <span className={
              new Decimal(order.total.toString())
                .minus(order.paid.toString())
                .gt(0)
                ? "text-red-600"
                : "text-green-600"
            }>
              {formatCurrency(
                new Decimal(order.total.toString()).minus(order.paid.toString())
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Customer info */}
      {order.customer && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">
              Billing
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p className="font-medium">{order.customer.name}</p>
            {order.customer.phone && <p className="text-muted-foreground">{order.customer.phone}</p>}
            {order.customer.address && <p className="text-muted-foreground">{order.customer.address}</p>}
          </CardContent>
        </Card>
      )}

      <Button variant="ghost" asChild>
        <Link href="/orders">← Back to orders</Link>
      </Button>
    </div>
  );
}
