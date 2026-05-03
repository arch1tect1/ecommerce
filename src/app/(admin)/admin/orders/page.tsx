import { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/order-status-badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { OrdersFilters } from "./_components/orders-filters";
import type { OrderStatus, PaymentStatus, Prisma } from "@prisma/client";

export const metadata: Metadata = { title: "Orders — Admin" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

interface PageProps {
  searchParams: Promise<{
    q?: string;
    status?: string;
    payment?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}

export default async function AdminOrdersPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  const where: Prisma.OrderWhereInput = {};
  if (sp.status && ["PENDING", "COMPLETED", "CANCELLED"].includes(sp.status)) {
    where.status = sp.status as OrderStatus;
  }
  if (sp.payment && ["UNPAID", "PARTIAL", "PAID"].includes(sp.payment)) {
    where.paymentStatus = sp.payment as PaymentStatus;
  }
  if (sp.q?.trim()) {
    where.OR = [
      { orderNumber: { contains: sp.q.trim(), mode: "insensitive" } },
      { customer: { name: { contains: sp.q.trim(), mode: "insensitive" } } },
      { customer: { taxId: { contains: sp.q.trim(), mode: "insensitive" } } },
    ];
  }
  if (sp.from || sp.to) {
    where.createdAt = {};
    if (sp.from) where.createdAt.gte = new Date(sp.from);
    if (sp.to) {
      const to = new Date(sp.to);
      to.setHours(23, 59, 59, 999);
      where.createdAt.lte = to;
    }
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        total: true,
        paid: true,
        createdAt: true,
        customer: { select: { id: true, name: true, taxId: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Orders</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {total} order{total !== 1 ? "s" : ""} matching your filters.
        </p>
      </div>

      <OrdersFilters />

      <div className="rounded-lg border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Order #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="text-center">Items</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-12">
                  No orders match your filters.
                </TableCell>
              </TableRow>
            ) : (
              orders.map((o) => (
                <TableRow key={o.id} className="hover:bg-muted/30">
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatDateTime(o.createdAt)}
                  </TableCell>
                  <TableCell className="font-mono text-sm font-medium">
                    {o.orderNumber}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/admin/customers/${o.customer.id}`}
                      className="text-sm font-medium hover:text-primary"
                    >
                      {o.customer.name}
                    </Link>
                    {o.customer.taxId && (
                      <p className="text-xs text-muted-foreground font-mono">{o.customer.taxId}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-center text-sm text-muted-foreground">{o._count.items}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(o.total)}</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">{formatCurrency(o.paid)}</TableCell>
                  <TableCell><OrderStatusBadge status={o.status} /></TableCell>
                  <TableCell><PaymentStatusBadge status={o.paymentStatus} /></TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/orders/${o.id}`}>Manage</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/orders?${buildHref(sp, page - 1)}`}>Previous</Link>
              </Button>
            )}
            {page < totalPages && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/orders?${buildHref(sp, page + 1)}`}>Next</Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function buildHref(sp: Awaited<PageProps["searchParams"]>, page: number): string {
  const p = new URLSearchParams();
  if (sp.q) p.set("q", sp.q);
  if (sp.status) p.set("status", sp.status);
  if (sp.payment) p.set("payment", sp.payment);
  if (sp.from) p.set("from", sp.from);
  if (sp.to) p.set("to", sp.to);
  p.set("page", String(page));
  return p.toString();
}
