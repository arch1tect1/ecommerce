"use server";

import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { registerSchema, changePasswordSchema } from "@/lib/validations/auth";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { auth } from "@/auth";

export type ActionResult =
  | { success: true; message?: string }
  | { success: false; error: string };

// ── Login ──────────────────────────────────────────────────────────────────

export async function loginAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/",
    });
  } catch (error) {
    // Next.js redirect throws a special error — rethrow so the redirect works
    if (
      error instanceof Error &&
      (error.message === "NEXT_REDIRECT" ||
        error.message.startsWith("NEXT_REDIRECT"))
    ) {
      throw error;
    }

    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { success: false, error: "Invalid email or password." };

        case "CallbackRouteError": {
          // The authorize() callback threw — usually a DB connection error
          const cause = (error as AuthError & { cause?: { err?: Error } }).cause?.err;
          if (process.env.NODE_ENV === "development" && cause) {
            return {
              success: false,
              error: `Server error: ${cause.message}`,
            };
          }
          return {
            success: false,
            error: "A server error occurred. Check that the database is reachable.",
          };
        }

        default:
          if (process.env.NODE_ENV === "development") {
            return {
              success: false,
              error: `Auth error [${error.type}]: ${error.message}`,
            };
          }
          return { success: false, error: "Something went wrong. Try again." };
      }
    }

    // Unknown error — log and surface in dev
    if (process.env.NODE_ENV === "development") {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Unexpected error: ${msg}` };
    }
    throw error;
  }
  return { success: true };
}

// ── Register ───────────────────────────────────────────────────────────────

export async function registerAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const raw = {
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]?.message ?? "Validation error";
    return { success: false, error: firstError };
  }

  const { fullName, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (existing) {
    return { success: false, error: "An account with that email already exists." };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      fullName,
      email: email.toLowerCase(),
      passwordHash,
    },
  });

  // Auto sign in after registration
  try {
    await signIn("credentials", {
      email: email.toLowerCase(),
      password,
      redirectTo: "/",
    });
  } catch (error) {
    throw error; // redirect throws — rethrow so Next.js handles it
  }

  return { success: true };
}

// ── Logout ─────────────────────────────────────────────────────────────────

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

// ── Change Password ────────────────────────────────────────────────────────

export async function changePasswordAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated." };
  }

  const raw = {
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  };

  const parsed = changePasswordSchema.safeParse(raw);
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]?.message ?? "Validation error";
    return { success: false, error: firstError };
  }

  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });
  if (!user) return { success: false, error: "User not found." };

  const match = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!match) {
    return { success: false, error: "Current password is incorrect." };
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash: newHash },
  });

  return { success: true, message: "Password changed successfully." };
}
