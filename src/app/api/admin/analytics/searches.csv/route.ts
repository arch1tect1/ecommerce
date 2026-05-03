import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSearchAnalytics, parseRange } from "@/lib/data/analytics-queries";

function csvEscape(value: string | number): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(request: Request) {
  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== "ADMIN" && session.user.role !== "MANAGER")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  const range = parseRange(from, to, 30);

  const rows = await getSearchAnalytics({
    from: range.from,
    to: range.to,
    limit: 5000,
  });

  const header = [
    "normalized_query",
    "sample_query",
    "total_searches",
    "unique_users",
    "avg_results",
    "click_through_rate",
    "last_searched",
  ];

  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        csvEscape(r.normalizedQuery),
        csvEscape(r.sampleQuery),
        r.totalSearches,
        r.uniqueUsers,
        r.avgResults.toFixed(2),
        r.clickThroughRate.toFixed(4),
        r.lastSearched.toISOString(),
      ].join(",")
    );
  }

  const fromYmd = range.from.toISOString().slice(0, 10);
  const toYmd = range.to.toISOString().slice(0, 10);
  const filename = `search-analytics_${fromYmd}_${toYmd}.csv`;

  return new NextResponse(lines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
