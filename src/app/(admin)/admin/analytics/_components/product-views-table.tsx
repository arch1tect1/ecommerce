"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ProductViewsRow } from "@/lib/data/analytics-queries";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

type SortKey = "views" | "uniqueViewers" | "inCartUsers" | "conversionRate";

export function ProductViewsTable({ rows }: { rows: ProductViewsRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("views");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === bv) return 0;
      const cmp = av < bv ? -1 : 1;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k)
      return <ArrowUpDown className="inline h-3 w-3 opacity-40" />;
    return sortDir === "asc" ? (
      <ArrowUp className="inline h-3 w-3" />
    ) : (
      <ArrowDown className="inline h-3 w-3" />
    );
  };

  return (
    <div className="space-y-3">
      <div className="rounded-md border bg-blue-50/40 p-3 text-xs text-muted-foreground">
        <strong>View → Cart</strong> rate = unique logged-in viewers who currently
        have the product in their cart, divided by unique logged-in viewers in
        the date range. Anonymous views are counted in <em>Views</em> but
        excluded from conversion.
      </div>

      <div className="overflow-hidden rounded-md border">
        <div className="max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">Product</th>
                <th
                  className="cursor-pointer px-3 py-2 text-right hover:text-foreground"
                  onClick={() => toggleSort("views")}
                >
                  Views <SortIcon k="views" />
                </th>
                <th
                  className="cursor-pointer px-3 py-2 text-right hover:text-foreground"
                  onClick={() => toggleSort("uniqueViewers")}
                >
                  Unique viewers <SortIcon k="uniqueViewers" />
                </th>
                <th
                  className="cursor-pointer px-3 py-2 text-right hover:text-foreground"
                  onClick={() => toggleSort("inCartUsers")}
                >
                  In cart <SortIcon k="inCartUsers" />
                </th>
                <th
                  className="cursor-pointer px-3 py-2 text-right hover:text-foreground"
                  onClick={() => toggleSort("conversionRate")}
                >
                  View → Cart <SortIcon k="conversionRate" />
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-8 text-center text-muted-foreground"
                  >
                    No product views in this range.
                  </td>
                </tr>
              ) : (
                sorted.map((row) => (
                  <tr key={row.productId} className="border-t hover:bg-muted/40">
                    <td className="px-3 py-2 font-mono text-xs">{row.sku}</td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/products/${row.productId}`}
                        className="text-blue-600 hover:underline"
                      >
                        {row.name}
                      </Link>
                      {!row.isActive && (
                        <span className="ml-2 rounded bg-gray-200 px-1.5 py-0.5 text-[10px] uppercase text-gray-700">
                          inactive
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.views}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.uniqueViewers}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.inCartUsers}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {(row.conversionRate * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
