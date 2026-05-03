import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  CustomersPayloadSchema,
  syncCustomers,
  runSync,
  verifySyncToken,
  checkRateLimit,
} from "@/lib/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  const token = request.headers.get("x-sync-token");
  if (!verifySyncToken(token)) {
    return NextResponse.json(
      { ok: false, error: "Invalid X-Sync-Token" },
      { status: 401 }
    );
  }
  const rl = checkRateLimit(token!);
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "Rate limit exceeded — 60 req/min per token" },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSeconds) },
      }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  let payload;
  try {
    payload = CustomersPayloadSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { ok: false, error: "Validation failed", issues: err.issues },
        { status: 400 }
      );
    }
    throw err;
  }

  const { syncLogId, result, status } = await runSync(
    "customers",
    "1C_PUSH",
    () => syncCustomers(payload)
  );

  return NextResponse.json({
    ok: status !== "FAILED",
    processed: result.processed,
    failed: result.failed,
    syncLogId,
    status,
  });
}
