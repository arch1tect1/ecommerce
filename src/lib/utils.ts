import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Decimal } from "decimal.js";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY ?? "AZN";

/**
 * Format a money value deterministically. Avoids `toLocaleString` because
 * Node.js (stub ICU on Windows) and the browser (full ICU) disagree on
 * decimal/thousand separators, causing Next.js hydration errors.
 *
 * Output: "1 234.56 AZN" — space thousands, period decimal.
 */
export function formatCurrency(value: Decimal | number | string): string {
  const num = value instanceof Decimal ? value.toNumber() : Number(value);
  const safe = Number.isFinite(num) ? num : 0;
  const sign = safe < 0 ? "-" : "";
  const [intPart, decPart = ""] = Math.abs(safe).toFixed(2).split(".");
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${withThousands}.${decPart} ${CURRENCY}`;
}

/** Format a Date as YYYY-MM-DD using UTC to avoid tz drift between server & client. */
export function formatDate(date: Date | string): string {
  const d = new Date(date);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Format a Date as YYYY-MM-DD HH:MM using UTC for determinism. */
export function formatDateTime(date: Date | string): string {
  const d = new Date(date);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  return `${y}-${mo}-${day} ${h}:${mi}`;
}

/** Zero-pad an order sequence number to 10 digits: 14987 → "0000014987" */
export function formatOrderNumber(seq: number): string {
  return String(seq).padStart(10, "0");
}

/** Normalize a search query: lowercase, trim, collapse spaces, remove dashes */
export function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .trim()
    .replace(/-/g, "")
    .replace(/\s+/g, " ");
}
