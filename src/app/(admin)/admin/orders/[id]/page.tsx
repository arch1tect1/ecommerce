import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Image from "next/image";
import { ChevronRight, Package } from "lucide-react";
import { Decimal } from "decimal.js";
import { prisma } from "@/lib/prisma";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/order-status-badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { OrderManageControls } from "./order-manage-controls";

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    select: { orderNumber: true },
  });
  return { title: order ? `Order ${order.orderNumber} — Admin` : "Order not found" };
}

export default async function AdminOrderDetailPage({ params }: Props) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
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
        select: {
          id: true,
          name: true,
          taxId: true,
          phone: true,
          address: true,
          balance: true,
        },
      },
    },
  });

  if (!order) notFound();

  const balanceDue = new Decimal(order.total.toString()).minus(order.paid.toString());

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/admin/orders" className="hover:text-foreground">Orders</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-mono font-medium">{order.orderNumber}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Order {order.orderNumber}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Placed {formatDateTime(order.createdAt)} · Customer:{" "}
            <Link href={`/admin/customers/${order.customer.id}`} className="hover:underline">
              {order.customer.name}
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <OrderStatusBadge status={order.status} />
          <PaymentStatusBadge status={order.paymentStatus} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main: items + totals */}
        <div className="lg:col-span-2 space-y-6">
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
                            <Link href={`/admin/products/${item.product.id}`} className="text-sm font-medium hover:underline">
                              {item.name}
                            </Link>
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

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Totals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm max-w-xs ml-auto">
                <div className="flex justify-between text-muted-foreground">
                  <span>Total</span>
                  <span>{formatCurrency(order.total)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Paid</span>
                  <span className="text-green-600">{formatCurrency(order.paid)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>Balance due</span>
                  <span className={balanceDue.gt(0) ? "text-red-600" : "text-green-600"}>
                    {formatCurrency(balanceDue)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar: management controls + customer info */}
        <div className="space-y-6">
          <OrderManageControls
            orderId={order.id}
            status={order.status}
            paid={order.paid.toString()}
            total={order.total.toString()}
            notes={order.notes ?? ""}
          />

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">
                Customer
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1.5">
              <Link href={`/admin/customers/${order.customer.id}`} className="font-medium hover:underline block">
                {order.customer.name}
              </Link>
              {order.customer.taxId && <p className="text-muted-foreground font-mono text-xs">{order.customer.taxId}</p>}
              {order.customer.phone && <p className="text-muted-foreground">{order.customer.phone}</p>}
              {order.customer.address && <p className="text-muted-foreground">{order.customer.address}</p>}
              <div className="pt-2 border-t flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Account balance</span>
                <span className={
                  Number(order.customer.balance) < 0
                    ? "text-red-600 font-semibold"
                    : "text-green-700 font-semibold"
                }>
                  {formatCurrency(order.customer.balance)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
