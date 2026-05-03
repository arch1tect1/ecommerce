/**
 * End-to-end smoke test for the 1C sync push endpoints.
 *
 * Usage:
 *   npx tsx scripts/test-1c-sync.ts                  # all endpoints
 *   npx tsx scripts/test-1c-sync.ts products stock   # subset
 *
 * Reads ONEC_SYNC_TOKEN from .env. Posts sample payloads to localhost:3000
 * and prints the response from each endpoint.
 */

/* eslint-disable no-console */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// ─── Minimal .env loader (no dotenv dep) ────────────────────────────────
function loadEnv(file = ".env") {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let value = m[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = value;
  }
}
loadEnv();

const BASE = process.env.SYNC_TEST_BASE_URL ?? "http://localhost:3000";
const TOKEN = process.env.ONEC_SYNC_TOKEN ?? "";

if (!TOKEN) {
  console.error("ONEC_SYNC_TOKEN is not set in .env — aborting.");
  process.exit(1);
}

type Step = {
  name: string;
  path: string;
  body: unknown;
};

const STEPS: Step[] = [
  {
    name: "categories",
    path: "/api/sync/1c/categories",
    body: {
      categories: [
        { externalId: "TEST-CAT-ROOT", name: "Test Root" },
        {
          externalId: "TEST-CAT-BRAKES",
          name: "Test Brakes",
          parentExternalId: "TEST-CAT-ROOT",
        },
        {
          externalId: "TEST-CAT-PADS",
          name: "Test Brake Pads",
          parentExternalId: "TEST-CAT-BRAKES",
        },
      ],
    },
  },
  {
    name: "products",
    path: "/api/sync/1c/products",
    body: {
      mode: "delta",
      products: [
        {
          externalId: "TEST-PRD-001",
          sku: "TEST-BRK-PAD-001",
          name: "Test Brake Pads — Front",
          description: "Sample product seeded by test-1c-sync.ts",
          brand: "TestBrand",
          categoryExternalId: "TEST-CAT-PADS",
          price: "84.50",
          stock: 27,
          isActive: true,
        },
        {
          externalId: "TEST-PRD-002",
          sku: "TEST-BRK-PAD-002",
          name: "Test Brake Pads — Rear",
          brand: "TestBrand",
          categoryExternalId: "TEST-CAT-PADS",
          price: 64.99,
          stock: 12,
        },
      ],
    },
  },
  {
    name: "stock",
    path: "/api/sync/1c/stock",
    body: {
      items: [
        { externalId: "TEST-PRD-001", stock: 33 },
        { externalId: "TEST-PRD-002", stock: 0 },
        { externalId: "DOES-NOT-EXIST", stock: 5 },
      ],
    },
  },
  {
    name: "prices",
    path: "/api/sync/1c/prices",
    body: {
      items: [
        { externalId: "TEST-PRD-001", price: "89.95" },
        { externalId: "TEST-PRD-002", price: 69.99 },
      ],
    },
  },
  {
    name: "customers",
    path: "/api/sync/1c/customers",
    body: {
      customers: [
        {
          externalId: "TEST-CUST-001",
          name: "Test Customer LLC",
          taxId: "9999999999",
          phone: "+994 50 999 9999",
          address: "Test Street 1, Baku",
          balance: "0.00",
          creditLimit: "1000.00",
        },
      ],
    },
  },
];

async function authProbe(): Promise<void> {
  console.log(`\n[probe] verifying X-Sync-Token rejects missing/wrong values…`);
  const url = `${BASE}/api/sync/1c/products`;
  const a = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  console.log(`  no token       → HTTP ${a.status}`);
  if (a.status !== 401) {
    throw new Error(`expected 401 without token, got ${a.status}`);
  }
  const b = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-sync-token": "definitely-wrong",
    },
    body: "{}",
  });
  console.log(`  wrong token    → HTTP ${b.status}`);
  if (b.status !== 401) {
    throw new Error(`expected 401 with wrong token, got ${b.status}`);
  }
  console.log(`  ✓ auth guard works`);
}

async function runStep(step: Step): Promise<boolean> {
  const url = `${BASE}${step.path}`;
  const t0 = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-sync-token": TOKEN,
    },
    body: JSON.stringify(step.body),
  });
  const ms = Date.now() - t0;
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const status = json.status ?? "?";
  const ok = res.ok && json.ok !== false;
  const indicator = ok ? "✓" : "✗";

  console.log(
    `\n[${step.name}] ${indicator} HTTP ${res.status} · ${ms} ms · status=${status} ` +
      `· processed=${json.processed} · failed=${json.failed}`
  );
  console.log(`  syncLogId: ${json.syncLogId ?? "(none)"}`);
  if (!ok || json.failed) {
    console.log("  response:", JSON.stringify(json, null, 2));
  }
  return ok;
}

async function main() {
  const args = process.argv.slice(2);
  const filter = args.length > 0 ? new Set(args) : null;
  const steps = filter ? STEPS.filter((s) => filter.has(s.name)) : STEPS;
  if (steps.length === 0) {
    console.error("No matching steps. Available:", STEPS.map((s) => s.name).join(", "));
    process.exit(1);
  }

  console.log(`Running ${steps.length} step(s) against ${BASE}`);
  await authProbe();

  let allOk = true;
  for (const step of steps) {
    const ok = await runStep(step).catch((err) => {
      console.error(`[${step.name}] threw:`, err);
      return false;
    });
    if (!ok) allOk = false;
  }

  console.log(
    `\n${allOk ? "✓ all steps OK" : "✗ one or more steps failed"} — see /admin/sync`
  );
  process.exit(allOk ? 0 : 1);
}

main();
