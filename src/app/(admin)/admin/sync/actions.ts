"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  runSync,
  syncProducts,
  syncStock,
  syncPrices,
  syncCategories,
  syncCustomers,
  ProductsPayloadSchema,
  StockPayloadSchema,
  PricesPayloadSchema,
  CategoriesPayloadSchema,
  CustomersPayloadSchema,
  SYNC_TYPES,
  type SyncType,
} from "@/lib/sync";

async function requireAdmin() {
  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== "ADMIN" && session.user.role !== "MANAGER")
  ) {
    throw new Error("Forbidden");
  }
}

export type ManualSyncResult = {
  ok: boolean;
  syncType: SyncType;
  syncLogId?: string;
  status: string;
  processed: number;
  failed: number;
  message?: string;
};

/**
 * Manual "Sync Now" trigger from the admin UI. Pulls from
 * `${ONEC_PULL_URL}/{type}` using the same logic as the cron job.
 * If pull URL is not configured, records a SKIPPED SyncLog so the
 * admin can verify the logging pipeline without 1C.
 */
export async function manualSyncAction(
  syncType: SyncType
): Promise<ManualSyncResult> {
  await requireAdmin();

  if (!SYNC_TYPES.includes(syncType)) {
    return {
      ok: false,
      syncType,
      status: "FAILED",
      processed: 0,
      failed: 0,
      message: `Unknown sync type: ${syncType}`,
    };
  }

  const baseUrl = process.env.ONEC_PULL_URL?.trim();
  const authHeader = process.env.ONEC_PULL_AUTH?.trim();

  const { syncLogId, status, result } = await runSync(
    syncType,
    "MANUAL",
    async () => {
      if (!baseUrl) {
        return {
          processed: 0,
          failed: 0,
          errors: [{ error: "1C pull URL not configured" }],
        };
      }
      const res = await fetch(`${baseUrl.replace(/\/$/, "")}/${syncType}`, {
        headers: authHeader ? { Authorization: authHeader } : {},
        signal: AbortSignal.timeout(60_000),
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(
          `1C ${syncType} returned HTTP ${res.status} ${res.statusText}`
        );
      }
      const json = await res.json();
      switch (syncType) {
        case "products":
          return syncProducts(ProductsPayloadSchema.parse(json));
        case "stock":
          return syncStock(StockPayloadSchema.parse(json));
        case "prices":
          return syncPrices(PricesPayloadSchema.parse(json));
        case "categories":
          return syncCategories(CategoriesPayloadSchema.parse(json));
        case "customers":
          return syncCustomers(CustomersPayloadSchema.parse(json));
      }
    }
  );

  revalidatePath("/admin/sync");
  return {
    ok: status !== "FAILED",
    syncType,
    syncLogId,
    status,
    processed: result.processed,
    failed: result.failed,
    message:
      status === "SKIPPED" && !baseUrl
        ? "ONEC_PULL_URL is not configured. SyncLog row created with SKIPPED status."
        : undefined,
  };
}
