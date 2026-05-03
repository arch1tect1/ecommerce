"use client";

import { useState, useMemo } from "react";
import type { SearchAnalyticsRow } from "@/lib/data/analytics-queries";
import { formatDateTime } from "@/lib/utils";
import { ArrowDown, ArrowUp, ArrowUpDown, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

type SerializedRow = Omit<SearchAnalyticsRow, "lastSearched"> & {
  lastSearched: string;
};

type SortKey =
  | "totalSearches"
  | "uniqueUsers"
  | "avgResults"
  | "clickThroughRate"
  | "lastSearched";

export function SearchAnalyticsTable({
  rows,
  csvHref,
}: {
  rows: SerializedRow[];
  csvHref: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("totalSearches");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      switch (sortKey) {
        case "lastSearched":
          av = a.lastSearched;
          bv = b.lastSearched;
          break;
        default:
          av = a[sortKey];
          bv = b[sortKey];
      }
      if (av === bv) return 0;
      const cmp = av < bv ? -1 : 1;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
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
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {rows.length} unique queries in selected range
        </p>
        <Button variant="outline" size="sm" asChild>
          <a href={csvHref} download>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </a>
        </Button>
      </div>

      <div className="overflow-hidden rounded-md border">
        <div className="max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Normalized query</th>
                <th
                  className="cursor-pointer px-3 py-2 text-right hover:text-foreground"
                  onClick={() => toggleSort("totalSearches")}
                >
                  Searches <SortIcon k="totalSearches" />
                </th>
                <th
                  className="cursor-pointer px-3 py-2 text-right hover:text-foreground"
                  onClick={() => toggleSort("uniqueUsers")}
                >
                  Unique users <SortIcon k="uniqueUsers" />
                </th>
                <th
                  className="cursor-pointer px-3 py-2 text-right hover:text-foreground"
                  onClick={() => toggleSort("avgResults")}
                >
                  Avg results <SortIcon k="avgResults" />
                </th>
                <th
                  className="cursor-pointer px-3 py-2 text-right hover:text-foreground"
                  onClick={() => toggleSort("clickThroughRate")}
                >
                  CTR <SortIcon k="clickThroughRate" />
                </th>
                <th
                  className="cursor-pointer px-3 py-2 text-right hover:text-foreground"
                  onClick={() => toggleSort("lastSearched")}
                >
                  Last searched <SortIcon k="lastSearched" />
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
                    No searches in this range.
                  </td>
                </tr>
              ) : (
                sorted.map((row) => (
                  <tr key={row.normalizedQuery} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">
                      {row.normalizedQuery}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.totalSearches}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.uniqueUsers}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.avgResults.toFixed(1)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {(row.clickThroughRate * 100).toFixed(1)}%
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                      {formatDateTime(row.lastSearched)}
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
