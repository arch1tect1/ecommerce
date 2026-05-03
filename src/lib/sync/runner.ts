import { prisma } from "@/lib/prisma";
import type { SyncResult, SyncType } from "./schemas";

export type SyncSource = "1C_PUSH" | "1C_PULL" | "MANUAL";

/**
 * Wraps a core sync function with SyncLog book-keeping:
 *  1. Open a SyncLog row with status=RUNNING
 *  2. Run the core function, capturing result or fatal error
 *  3. Close the SyncLog with the appropriate terminal status
 *
 * Status mapping:
 *  - SUCCESS  — processed > 0, failed === 0
 *  - PARTIAL  — processed > 0, failed > 0
 *  - SKIPPED  — processed === 0 and failed === 0 (no-op, e.g. empty payload)
 *  - FAILED   — fatal error before/during run
 */
export async function runSync(
  syncType: SyncType,
  source: SyncSource,
  fn: () => Promise<SyncResult>
): Promise<{ syncLogId: string; result: SyncResult; status: string }> {
  const log = await prisma.syncLog.create({
    data: {
      source,
      syncType,
      status: "RUNNING",
      startedAt: new Date(),
    },
  });

  try {
    const result = await fn();
    const status =
      result.failed === 0 && result.processed === 0
        ? "SKIPPED"
        : result.failed > 0 && result.processed > 0
          ? "PARTIAL"
          : result.failed > 0
            ? "FAILED"
            : "SUCCESS";

    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        status,
        recordsProcessed: result.processed,
        recordsFailed: result.failed,
        finishedAt: new Date(),
        errorDetails:
          result.errors.length > 0
            ? JSON.parse(JSON.stringify(result.errors.slice(0, 100)))
            : undefined,
      },
    });
    return { syncLogId: log.id, result, status };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        errorDetails: { fatal: message } as object,
      },
    });
    return {
      syncLogId: log.id,
      status: "FAILED",
      result: { processed: 0, failed: 0, errors: [{ error: message }] },
    };
  }
}

/** Yield 500-row chunks from an array. */
export function* chunks<T>(arr: T[], size = 500): Generator<T[]> {
  for (let i = 0; i < arr.length; i += size) {
    yield arr.slice(i, i + size);
  }
}
