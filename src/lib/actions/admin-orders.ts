"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Decimal } from "decimal.js";
import type { OrderStatus, PaymentStatus } from "@prisma/client";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "MANAGER")) {
    throw new Error("Unauthorized");
  }
}

// ── Update status ──────────────────────────────────────────────────────────

const statusSchema = z.enum(["PENDING", "COMPLETED", "CANCELLED"]);

export async function updateOrderStatusAction(
  orderId: string,
  status: OrderStatus
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireAdmin();
    const parsed = statusSchema.safeParse(status);
    if (!parsed.success) return { ok: false, error: "Invalid status" };

    await prisma.order.update({
      where: { id: orderId },
      data: { status: parsed.data },
    });
    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath(`/orders/${orderId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

// ── Update paid amount + auto-derive paymentStatus ─────────────────────────

const paidSchema = z.object({
  paid: z.coerce.number().min(0),
});

export async function updateOrderPaidAction(
  orderId: string,
  paid: number
): Promise<{ ok: true; paymentStatus: PaymentStatus } | { ok: false; error: string }> {
  try {
    await requireAdmin();
    const parsed = paidSchema.safeParse({ paid });
    if (!parsed.success) return { ok: false, error: "Invalid amount" };

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { total: true },
    });
    if (!order) return { ok: false, error: "Order not found" };

    const total = new Decimal(order.total.toString());
    const paidD = new Decimal(parsed.data.paid);

    if (paidD.gt(total)) {
      return { ok: false, error: `Paid amount cannot exceed order total (${total.toFixed(2)})` };
    }

    let paymentStatus: PaymentStatus;
    if (paidD.lte(0)) paymentStatus = "UNPAID";
    else if (paidD.gte(total)) paymentStatus = "PAID";
    else paymentStatus = "PARTIAL";

    await prisma.order.update({
      where: { id: orderId },
      data: { paid: paidD.toFixed(2), paymentStatus },
    });

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath(`/orders/${orderId}`);
    return { ok: true, paymentStatus };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

// ── Update internal notes ──────────────────────────────────────────────────

const notesSchema = z.object({
  notes: z.string().max(2000),
});

export async function updateOrderNotesAction(
  orderId: string,
  notes: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireAdmin();
    const parsed = notesSchema.safeParse({ notes });
    if (!parsed.success) return { ok: false, error: "Notes too long (max 2000 chars)" };

    await prisma.order.update({
      where: { id: orderId },
      data: { notes: parsed.data.notes.trim() || null },
    });
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}
