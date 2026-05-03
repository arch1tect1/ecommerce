"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";

async function requireAdmin() {
  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== "ADMIN" && session.user.role !== "MANAGER")
  ) {
    throw new Error("Unauthorized");
  }
  return session;
}

// ── Link user to an existing Customer ─────────────────────────────────────

export async function linkUserToCustomerAction(
  userId: string,
  customerId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    await prisma.user.update({
      where: { id: userId },
      data: { customerId },
    });
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to link";
    return { ok: false, error: msg };
  }
}

// ── Create a new Customer and link to user ─────────────────────────────────

const createCustomerSchema = z.object({
  name: z.string().min(1, "Company name is required").max(200),
  taxId: z.string().max(50).optional(),
  phone: z.string().max(50).optional(),
  address: z.string().max(300).optional(),
  balance: z.coerce.number().default(0),
  creditLimit: z.coerce.number().min(0).default(0),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export async function createCustomerAndLinkAction(
  userId: string,
  input: CreateCustomerInput
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();

    const parsed = createCustomerSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid data" };
    }

    const { name, taxId, phone, address, balance, creditLimit } = parsed.data;

    // Use a unique externalId for manually-created records so 1C sync can
    // identify them and replace this placeholder later if needed.
    const externalId = `MANUAL-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const customer = await prisma.customer.create({
      data: {
        externalId,
        name,
        taxId: taxId || null,
        phone: phone || null,
        address: address || null,
        balance,
        creditLimit,
      },
    });

    await prisma.user.update({
      where: { id: userId },
      data: { customerId: customer.id },
    });

    revalidatePath("/admin/users");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create customer";
    return { ok: false, error: msg };
  }
}

// ── Unlink user from their Customer ───────────────────────────────────────

export async function unlinkUserFromCustomerAction(
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    await prisma.user.update({
      where: { id: userId },
      data: { customerId: null },
    });
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to unlink";
    return { ok: false, error: msg };
  }
}

// ── Update user role ───────────────────────────────────────────────────────

const roleSchema = z.enum(["ADMIN", "MANAGER", "CUSTOMER"]);

export async function updateUserRoleAction(
  userId: string,
  role: "ADMIN" | "MANAGER" | "CUSTOMER"
): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = await requireAdmin();
    const parsed = roleSchema.safeParse(role);
    if (!parsed.success) return { ok: false, error: "Invalid role" };

    // Don't let an admin demote themselves (foot-gun prevention)
    if (session.user!.id === userId && parsed.data !== "ADMIN") {
      return { ok: false, error: "You cannot change your own role from ADMIN. Ask another admin." };
    }

    await prisma.user.update({
      where: { id: userId },
      data: { role: parsed.data },
    });
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update role";
    return { ok: false, error: msg };
  }
}

// ── Deactivate / reactivate user (soft delete) ─────────────────────────────

export async function setUserActiveAction(
  userId: string,
  isActive: boolean
): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = await requireAdmin();
    if (session.user!.id === userId && !isActive) {
      return { ok: false, error: "You cannot deactivate your own account." };
    }
    await prisma.user.update({
      where: { id: userId },
      data: { isActive },
    });
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

// ── Reset password (generate temporary, return once) ───────────────────────
// The plaintext is returned ONLY in this single response. The admin must
// communicate it to the user out of band; it is never stored anywhere.

function generateTempPassword(): string {
  // 12 chars: 4 upper, 4 lower, 2 digits, 2 specials — easy to read aloud
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I/O
  const lower = "abcdefghjkmnpqrstuvwxyz"; // no l/i/o
  const digits = "23456789"; // no 0/1
  const special = "!@#$%&*";
  const pick = (set: string, n: number) =>
    Array.from({ length: n }, () => set[Math.floor(Math.random() * set.length)]).join("");
  const all = pick(upper, 4) + pick(lower, 4) + pick(digits, 2) + pick(special, 2);
  // Fisher-Yates shuffle
  const arr = all.split("");
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join("");
}

export async function resetUserPasswordAction(
  userId: string
): Promise<{ ok: true; tempPassword: string } | { ok: false; error: string }> {
  try {
    await requireAdmin();
    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    revalidatePath("/admin/users");
    return { ok: true, tempPassword };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}
