import { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { Prisma } from "@prisma/client";

export const metadata: Metadata = { title: "Customers — Admin" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export default async function AdminCustomersPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  const where: Prisma.CustomerWhereInput = {};
  if (sp.q?.trim()) {
    where.OR = [
      { name:  { contains: sp.q.trim(), mode: "insensitive" } },
      { taxId: { contains: sp.q.trim(), mode: "insensitive" } },
      { phone: { contains: sp.q.trim(), mode: "insensitive" } },
    ];
  }

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        taxId: true,
        phone: true,
        balance: true,
        creditLimit: true,
        _count: { select: { orders: true } },
        orders: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
      },
    }),
    prisma.customer.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Customers</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {total} customer{total !== 1 ? "s" : ""}.
        </p>
      </div>

      <form className="flex gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Search by name, tax ID, or phone…"
            className="pl-9"
          />
        </div>
        <Button type="submit">Search</Button>
      </form>

      <div className="rounded-lg border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Tax ID</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="text-right">Credit limit</TableHead>
              <TableHead className="text-center">Orders</TableHead>
              <TableHead>Last order</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                  No customers found.
                </TableCell>
              </TableRow>
            ) : (
              customers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-sm font-mono text-muted-foreground">{c.taxId ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.phone ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <span className={Number(c.balance) < 0 ? "text-red-600 font-semibold" : "font-medium"}>
                      {formatCurrency(c.balance)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-sm">{formatCurrency(c.creditLimit)}</TableCell>
                  <TableCell className="text-center text-sm">{c._count.orders}</TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {c.orders[0] ? formatDateTime(c.orders[0].createdAt) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/customers/${c.id}`}>View</Link>
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
                <Link href={`/admin/customers?${buildHref(sp, page - 1)}`}>Previous</Link>
              </Button>
            )}
            {page < totalPages && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/customers?${buildHref(sp, page + 1)}`}>Next</Link>
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
  p.set("page", String(page));
  return p.toString();
}
