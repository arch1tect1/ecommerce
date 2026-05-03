"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CustomerActivityRow } from "@/lib/data/analytics-queries";
import { formatDateTime } from "@/lib/utils";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

type SerializedRow = Omit<CustomerActivityRow, "lastActive"> & {
  lastActive: string;
};

type SortKey = "searchCount" | "viewCount" | "lastActive";

export function CustomerActivityTable({ rows }: { rows: SerializedRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("lastActive");
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
    <div className="overflow-hidden rounded-md border">
      <div className="max-h-[600px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Customer</th>
              <th
                className="cursor-pointer px-3 py-2 text-right hover:text-foreground"
                onClick={() => toggleSort("searchCount")}
              >
                Searches <SortIcon k="searchCount" />
              </th>
              <th
                className="cursor-pointer px-3 py-2 text-right hover:text-foreground"
                onClick={() => toggleSort("viewCount")}
              >
                Views <SortIcon k="viewCount" />
              </th>
              <th
                className="cursor-pointer px-3 py-2 text-right hover:text-foreground"
                onClick={() => toggleSort("lastActive")}
              >
                Last active <SortIcon k="lastActive" />
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  No customer activity in this range.
                </td>
              </tr>
            ) : (
              sorted.map((row) => {
                const drillHref = row.customerId
                  ? `/admin/customers/${row.customerId}`
                  : null;
                return (
                  <tr
                    key={row.userId}
                    className="border-t hover:bg-muted/40"
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium">{row.fullName}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.email}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {drillHref ? (
                        <Link
                          href={drillHref}
                          className="text-blue-600 hover:underline"
                        >
                          {row.customerName ?? "View timeline →"}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          (not linked)
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.searchCount}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.viewCount}
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                      {formatDateTime(row.lastActive)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
