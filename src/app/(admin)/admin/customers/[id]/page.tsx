import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Search, Eye, MousePointerClick } from "lucide-react";
import { Decimal } from "decimal.js";
import { prisma } from "@/lib/prisma";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/order-status-badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const c = await prisma.customer.findUnique({ where: { id }, select: { name: true } });
  return { title: c ? `${c.name} — Admin` : "Customer not found" };
}

interface ActivityEvent {
  kind: "search" | "view";
  id: string;
  createdAt: Date;
  payload:
    | { kind: "search"; query: string; resultCount: number; clickedSku: string | null }
    | { kind: "view"; productSku: string; productName: string };
}

export default async function AdminCustomerDetailPage({ params }: Props) {
  const { id } = await params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, email: true, fullName: true, lastLoginAt: true, role: true },
      },
      orders: {
        orderBy: { createdAt: "desc" },
        take: 50,
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
      },
      _count: { select: { orders: true } },
    },
  });

  if (!customer) notFound();

  // Total spent and paid (across ALL orders, not just the recent 50)
  const aggregates = await prisma.order.aggregate({
    where: { customerId: id, status: { not: "CANCELLED" } },
    _sum: { total: true, paid: true },
  });
  const totalSpent = new Decimal(aggregates._sum.total?.toString() ?? "0");
  const totalPaid = new Decimal(aggregates._sum.paid?.toString() ?? "0");
  const debt = totalSpent.minus(totalPaid);

  // Activity timeline — only if user is linked
  let activity: ActivityEvent[] = [];
  if (customer.user) {
    const userId = customer.user.id;
    const [searches, views] = await Promise.all([
      prisma.searchEvent.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          query: true,
          resultCount: true,
          clickedProductId: true,
          createdAt: true,
        },
      }),
      prisma.productView.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          createdAt: true,
          product: { select: { sku: true, name: true } },
        },
      }),
    ]);

    // Look up clicked product SKUs
    const clickedIds = Array.from(
      new Set(searches.map((s) => s.clickedProductId).filter((v): v is string => !!v))
    );
    const clickedProducts = clickedIds.length
      ? await prisma.product.findMany({
          where: { id: { in: clickedIds } },
          select: { id: true, sku: true },
        })
      : [];
    const skuById = new Map(clickedProducts.map((p) => [p.id, p.sku]));

    activity = [
      ...searches.map<ActivityEvent>((s) => ({
        kind: "search",
        id: `s-${s.id}`,
        createdAt: s.createdAt,
        payload: {
          kind: "search",
          query: s.query,
          resultCount: s.resultCount,
          clickedSku: s.clickedProductId ? skuById.get(s.clickedProductId) ?? null : null,
        },
      })),
      ...views.map<ActivityEvent>((v) => ({
        kind: "view",
        id: `v-${v.id}`,
        createdAt: v.createdAt,
        payload: {
          kind: "view",
          productSku: v.product.sku,
          productName: v.product.name,
        },
      })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 40);
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/admin/customers" className="hover:text-foreground">Customers</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">{customer.name}</span>
      </nav>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{customer.name}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {customer.taxId && <span className="font-mono">{customer.taxId}</span>}
          {customer.phone && <span> · {customer.phone}</span>}
          {customer.address && <span> · {customer.address}</span>}
          {customer.user && (
            <span> · Linked to <strong>{customer.user.email}</strong></span>
          )}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Account balance" value={formatCurrency(customer.balance)} highlight={Number(customer.balance) < 0} />
        <KpiCard label="Credit limit" value={formatCurrency(customer.creditLimit)} />
        <KpiCard label="Total orders" value={String(customer._count.orders)} />
        <KpiCard
          label="Outstanding debt"
          value={formatCurrency(debt.toFixed(2))}
          highlight={debt.gt(0)}
          sub={`Spent ${formatCurrency(totalSpent.toFixed(2))} · Paid ${formatCurrency(totalPaid.toFixed(2))}`}
        />
      </div>

      {/* Orders history */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Orders ({customer._count.orders})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {customer.orders.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No orders yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Date</TableHead>
                  <TableHead>Order #</TableHead>
                  <TableHead className="text-center">Items</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customer.orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="pl-6 text-sm text-muted-foreground whitespace-nowrap">
                      {formatDateTime(o.createdAt)}
                    </TableCell>
                    <TableCell className="font-mono text-sm font-medium">{o.orderNumber}</TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">{o._count.items}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(o.total)}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{formatCurrency(o.paid)}</TableCell>
                    <TableCell><OrderStatusBadge status={o.status} /></TableCell>
                    <TableCell><PaymentStatusBadge status={o.paymentStatus} /></TableCell>
                    <TableCell className="text-right pr-6">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/orders/${o.id}`}>Manage</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Activity timeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Activity timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {!customer.user ? (
            <p className="text-sm text-muted-foreground">
              No linked user account — no activity to display.
            </p>
          ) : activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tracked activity yet.</p>
          ) : (
            <ol className="relative border-l ml-2 space-y-3 pl-4">
              {activity.map((ev) => (
                <li key={ev.id} className="text-sm">
                  <div className={`absolute -left-[7px] mt-1 w-3 h-3 rounded-full ${
                    ev.kind === "search" ? "bg-blue-500" : "bg-emerald-500"
                  }`} />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(ev.createdAt)}
                    </span>
                    {ev.kind === "search" && ev.payload.kind === "search" ? (
                      <span className="flex items-center gap-1.5">
                        <Search className="h-3.5 w-3.5 text-blue-500" />
                        <span>
                          Searched <strong className="font-mono">&ldquo;{ev.payload.query}&rdquo;</strong>{" "}
                          <Badge variant="outline" className="text-[10px] ml-0.5">
                            {ev.payload.resultCount} result{ev.payload.resultCount !== 1 ? "s" : ""}
                          </Badge>
                          {ev.payload.clickedSku && (
                            <span className="ml-1 inline-flex items-center gap-1 text-muted-foreground">
                              <MousePointerClick className="h-3 w-3" />
                              clicked <span className="font-mono">{ev.payload.clickedSku}</span>
                            </span>
                          )}
                        </span>
                      </span>
                    ) : ev.payload.kind === "view" ? (
                      <span className="flex items-center gap-1.5">
                        <Eye className="h-3.5 w-3.5 text-emerald-500" />
                        <span>
                          Viewed <span className="font-mono">{ev.payload.productSku}</span>
                          <span className="text-muted-foreground"> — {ev.payload.productName}</span>
                        </span>
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  label, value, sub, highlight = false,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-xl font-bold ${highlight ? "text-red-600" : ""}`}>{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}
