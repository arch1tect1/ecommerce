/**
 * Quick burst test — sends 70 rapid requests to /api/sync/1c/stock with
 * the valid token. Expects ~60 to succeed (200) and ~10 to be rate-limited
 * (429 + Retry-After header).
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  const path = resolve(process.cwd(), ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
loadEnv();

const BASE = process.env.SYNC_TEST_BASE_URL ?? "http://localhost:3000";
const TOKEN = process.env.ONEC_SYNC_TOKEN ?? "";

async function main() {
  const N = 70;
  console.log(`Firing ${N} parallel requests at ${BASE}/api/sync/1c/stock`);

  const results = await Promise.all(
    Array.from({ length: N }, () =>
      fetch(`${BASE}/api/sync/1c/stock`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-sync-token": TOKEN,
        },
        body: JSON.stringify({ items: [] }),
      }).then((r) => ({
        status: r.status,
        retryAfter: r.headers.get("retry-after"),
      }))
    )
  );

  const ok = results.filter((r) => r.status === 200).length;
  const limited = results.filter((r) => r.status === 429).length;
  const other = results.filter((r) => r.status !== 200 && r.status !== 429).length;

  console.log(`OK 200:        ${ok}`);
  console.log(`Limited 429:   ${limited}`);
  console.log(`Other:         ${other}`);
  if (limited > 0) {
    const retries = [...new Set(results.filter((r) => r.status === 429).map((r) => r.retryAfter))];
    console.log(`Retry-After samples: ${retries.join(", ")}`);
  }
  if (ok > 60 || ok < 50) {
    console.error("⚠ unexpected ok count");
    process.exit(1);
  }
  if (limited === 0) {
    console.error("⚠ rate limit never tripped");
    process.exit(1);
  }
  console.log("✓ rate limiter working");
}
main();
