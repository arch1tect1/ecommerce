import { prisma } from "@/lib/prisma";
import { chunks } from "./runner";
import type { CustomersPayload, SyncResult } from "./schemas";

/**
 * Upsert customers by externalId. Customer model has no isActive flag —
 * 1C is the source of truth, so we never deactivate. Locally-created
 * customers (externalId starting with "local-") are skipped.
 */
export async function syncCustomers(
  payload: CustomersPayload
): Promise<SyncResult> {
  const errors: SyncResult["errors"] = [];
  let processed = 0;
  let failed = 0;

  for (const chunk of chunks(payload.customers, 500)) {
    try {
      await prisma.$transaction(
        async (tx) => {
          for (const c of chunk) {
            await tx.customer.upsert({
              where: { externalId: c.externalId },
              create: {
                externalId: c.externalId,
                name: c.name,
                taxId: c.taxId ?? null,
                phone: c.phone ?? null,
                address: c.address ?? null,
                balance: c.balance,
                creditLimit: c.creditLimit,
              },
              update: {
                name: c.name,
                taxId: c.taxId ?? null,
                phone: c.phone ?? null,
                address: c.address ?? null,
                balance: c.balance,
                creditLimit: c.creditLimit,
              },
            });
          }
        },
        { timeout: 60_000, maxWait: 10_000 }
      );
      processed += chunk.length;
    } catch {
      for (const c of chunk) {
        try {
          await prisma.customer.upsert({
            where: { externalId: c.externalId },
            create: {
              externalId: c.externalId,
              name: c.name,
              taxId: c.taxId ?? null,
              phone: c.phone ?? null,
              address: c.address ?? null,
              balance: c.balance,
              creditLimit: c.creditLimit,
            },
            update: {
              name: c.name,
              taxId: c.taxId ?? null,
              phone: c.phone ?? null,
              address: c.address ?? null,
              balance: c.balance,
              creditLimit: c.creditLimit,
            },
          });
          processed++;
        } catch (e) {
          failed++;
          errors.push({
            externalId: c.externalId,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
    }
  }

  return { processed, failed, errors };
}
