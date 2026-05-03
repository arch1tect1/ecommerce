/**
 * Best-effort in-memory rate limiter for the 1C sync endpoints.
 *
 * 60 requests per minute per token (sliding window). Designed to mitigate
 * a leaked X-Sync-Token being abused to flood the DB; not a security
 * boundary.
 *
 * Caveats:
 *   • Vercel serverless functions have their own per-instance memory, so
 *     concurrent traffic spread across multiple cold-started instances is
 *     not coordinated. Real production traffic from a single 1C client
 *     stays "warm" on one instance, which is the case we care about.
 *   • For strict global limits, swap this for Upstash Redis or Vercel KV.
 */

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60;

// Map<tokenFingerprint, timestamps[]>
const buckets = new Map<string, number[]>();
let lastSweep = 0;

function fingerprint(token: string): string {
  // Fingerprint instead of storing the raw token. Cheap, non-cryptographic.
  let h = 0;
  for (let i = 0; i < token.length; i++) {
    h = (h * 31 + token.charCodeAt(i)) | 0;
  }
  return `t:${h}:${token.length}`;
}

function sweep(now: number): void {
  if (now - lastSweep < WINDOW_MS) return;
  lastSweep = now;
  for (const [key, arr] of buckets) {
    const fresh = arr.filter((t) => now - t < WINDOW_MS);
    if (fresh.length === 0) buckets.delete(key);
    else buckets.set(key, fresh);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Records a request for the given token and returns whether it should be
 * allowed. Returns retry-after (seconds) when blocked.
 */
export function checkRateLimit(token: string): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const key = fingerprint(token);
  const arr = buckets.get(key) ?? [];
  const recent = arr.filter((t) => now - t < WINDOW_MS);

  if (recent.length >= MAX_PER_WINDOW) {
    const oldest = recent[0]!;
    const retryAfterMs = WINDOW_MS - (now - oldest);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  recent.push(now);
  buckets.set(key, recent);
  return {
    allowed: true,
    remaining: MAX_PER_WINDOW - recent.length,
    retryAfterSeconds: 0,
  };
}

/** Test-only: clear all buckets. */
export function _resetRateLimit(): void {
  buckets.clear();
  lastSweep = 0;
}
