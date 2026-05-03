import { NextResponse } from "next/server";
import {
  syncProducts,
  syncStock,
  syncPrices,
  syncCategories,
  syncCustomers,
  runSync,
  verifyCronAuth,
  ProductsPayloadSchema,
  StockPayloadSchema,
  PricesPayloadSchema,
  CategoriesPayloadSchema,
  CustomersPayloadSchema,
  SYNC_TYPES,
  type SyncType,
} from "@/lib/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Vercel Cron pull endpoint. Vercel calls this every 30 minutes (see
 * vercel.json) with `Authorization: Bearer ${CRON_SECRET}`.
 *
 * For each sync type we issue an HTTP GET to `${ONEC_PULL_URL}/{type}`
 * with the configured Authorization header, parse + validate the JSON,
 * and feed it into the same core sync function used by the push routes.
 *
 * If `ONEC_PULL_URL` is not configured we log a SKIPPED SyncLog row
 * for each type and return — never crashing.
 */
export async function GET(request: Request) {
  if (!verifyCronAuth(request.headers.get("authorization"))) {
    return NextResponse.json(
      { ok: false, error: "Invalid cron auth" },
      { status: 401 }
    );
  }

  const baseUrl = process.env.ONEC_PULL_URL?.trim();
  const authHeader = process.env.ONEC_PULL_AUTH?.trim();

  if (!baseUrl) {
    // Configuration absent — record a SKIPPED log per type, no crash.
    const logs = await Promise.all(
      SYNC_TYPES.map((type) =>
        runSync(type, "1C_PULL", async () => ({
          processed: 0,
          failed: 0,
          errors: [{ error: "1C pull URL not configured" }],
        }))
      )
    );
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "ONEC_PULL_URL not configured",
      runs: logs.map((l) => ({
        syncLogId: l.syncLogId,
        status: l.status,
      })),
    });
  }

  // Pull each type sequentially so we can report individual results.
  const runs: Array<{
    syncType: SyncType;
    syncLogId: string;
    status: string;
    processed: number;
    failed: number;
  }> = [];

  for (const type of SYNC_TYPES) {
    const { syncLogId, status, result } = await runSync(
      type,
      "1C_PULL",
      async () => {
        const res = await fetch(`${baseUrl.replace(/\/$/, "")}/${type}`, {
          headers: authHeader ? { Authorization: authHeader } : {},
          // 1C servers are slow — give them up to 60s per request
          signal: AbortSignal.timeout(60_000),
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(
            `1C ${type} returned HTTP ${res.status} ${res.statusText}`
          );
        }
        const json = await res.json();

        switch (type) {
          case "products": {
            const payload = ProductsPayloadSchema.parse(json);
            return syncProducts(payload);
          }
          case "stock": {
            const payload = StockPayloadSchema.parse(json);
            return syncStock(payload);
          }
          case "prices": {
            const payload = PricesPayloadSchema.parse(json);
            return syncPrices(payload);
          }
          case "categories": {
            const payload = CategoriesPayloadSchema.parse(json);
            return syncCategories(payload);
          }
          case "customers": {
            const payload = CustomersPayloadSchema.parse(json);
            return syncCustomers(payload);
          }
        }
      }
    );
    runs.push({
      syncType: type,
      syncLogId,
      status,
      processed: result.processed,
      failed: result.failed,
    });
  }

  const anyFailed = runs.some((r) => r.status === "FAILED");
  return NextResponse.json({ ok: !anyFailed, runs });
}
