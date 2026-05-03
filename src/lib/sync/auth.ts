import { timingSafeEqual } from "crypto";

/**
 * Constant-time comparison of an incoming X-Sync-Token header against
 * `process.env.ONEC_SYNC_TOKEN`. Returns false when:
 *  - the env var is unset
 *  - the header is missing
 *  - the lengths differ (still does a fixed-time compare against itself
 *    to avoid leaking info about the expected length)
 *  - the values differ
 */
export function verifySyncToken(headerValue: string | null): boolean {
  const expected = process.env.ONEC_SYNC_TOKEN;
  if (!expected || expected.length < 8) return false;
  if (!headerValue) return false;

  const a = Buffer.from(headerValue, "utf8");
  const b = Buffer.from(expected, "utf8");

  if (a.length !== b.length) {
    // Length-mismatch — still spend constant time so we don't leak
    // the expected token length via timing.
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

/**
 * Verifies the Authorization header sent by Vercel Cron.
 * Vercel auto-attaches `Authorization: Bearer ${CRON_SECRET}`
 * to scheduled cron jobs.
 */
export function verifyCronAuth(headerValue: string | null): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected || expected.length < 8) return false;
  if (!headerValue) return false;
  const stripped = headerValue.startsWith("Bearer ")
    ? headerValue.slice("Bearer ".length)
    : headerValue;

  const a = Buffer.from(stripped, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}
