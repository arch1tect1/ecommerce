import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { SYNC_TYPES, type SyncType } from "@/lib/sync";
import { ManualSyncButtons } from "./_components/manual-sync-buttons";
import {
  SyncHistoryTable,
  type SerializedSyncLog,
} from "./_components/sync-history-table";

export const metadata = { title: "1C Sync" };
export const dynamic = "force-dynamic";

const STALE_AFTER_MS: Record<SyncType, number> = {
  stock: 60 * 60 * 1000, // 1h
  prices: 24 * 60 * 60 * 1000, // 24h
  products: 24 * 60 * 60 * 1000, // 24h
  categories: 24 * 60 * 60 * 1000, // 24h
  customers: 24 * 60 * 60 * 1000, // 24h
};

const CRON_SCHEDULE = "*/30 * * * *"; // matches vercel.json
const CRON_DESCRIPTION = "every 30 minutes";

export default async function SyncPage() {
  const [history, lastSuccessRows] = await Promise.all([
    prisma.syncLog.findMany({
      orderBy: { startedAt: "desc" },
      take: 100,
    }),
    // Latest SUCCESS|PARTIAL row per syncType
    prisma.$queryRaw<
      Array<{
        syncType: string;
        startedAt: Date;
        recordsProcessed: number;
        status: string;
      }>
    >`
      SELECT DISTINCT ON ("syncType")
        "syncType", "startedAt", "recordsProcessed", "status"
      FROM "SyncLog"
      WHERE "status" IN ('SUCCESS', 'PARTIAL')
      ORDER BY "syncType", "startedAt" DESC
    `,
  ]);

  const lastSuccessByType = new Map(
    lastSuccessRows.map((r) => [r.syncType, r])
  );
  const now = Date.now();
  const pullConfigured = Boolean(process.env.ONEC_PULL_URL?.trim());

  const serialized: SerializedSyncLog[] = history.map((h) => ({
    id: h.id,
    source: h.source,
    syncType: h.syncType,
    status: h.status,
    recordsProcessed: h.recordsProcessed,
    recordsFailed: h.recordsFailed,
    errorDetails: h.errorDetails,
    startedAt: h.startedAt.toISOString(),
    finishedAt: h.finishedAt?.toISOString() ?? null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">1C Sync</h1>
        <p className="mt-1 text-muted-foreground">
          Push endpoints, scheduled pull, and run history.
        </p>
      </div>

      {/* Cron / configuration ────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" /> Scheduled cron
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Endpoint</span>
              <code className="font-mono text-xs">/api/cron/sync-1c</code>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Schedule</span>
              <span>
                <code className="font-mono text-xs">{CRON_SCHEDULE}</code>{" "}
                <span className="text-muted-foreground">({CRON_DESCRIPTION})</span>
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">1C pull URL</span>
              {pullConfigured ? (
                <Badge variant="success">configured</Badge>
              ) : (
                <Badge variant="secondary">not configured</Badge>
              )}
            </div>
            <p className="pt-2 text-xs text-muted-foreground">
              Vercel calls this endpoint with{" "}
              <code className="font-mono">Authorization: Bearer $CRON_SECRET</code>
              . When the pull URL is unset, each cron run records a SKIPPED
              SyncLog row instead of failing.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              Push endpoints
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              POST with header <code className="font-mono">X-Sync-Token</code>.
            </p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 font-mono text-xs">
              <li>POST /api/sync/1c/products</li>
              <li>POST /api/sync/1c/stock</li>
              <li>POST /api/sync/1c/prices</li>
              <li>POST /api/sync/1c/categories</li>
              <li>POST /api/sync/1c/customers</li>
            </ul>
            <p className="pt-2 text-xs text-muted-foreground">
              See <code>docs/1c-integration.md</code> for payload shapes and curl
              examples.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Stale warnings ──────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {SYNC_TYPES.map((type) => {
          const last = lastSuccessByType.get(type);
          const ageMs = last
            ? now - new Date(last.startedAt).getTime()
            : Number.POSITIVE_INFINITY;
          const stale = ageMs > STALE_AFTER_MS[type];
          return (
            <Card key={type}>
              <CardContent className="space-y-1 pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium capitalize">{type}</span>
                  {!last ? (
                    <Badge variant="secondary">never</Badge>
                  ) : stale ? (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" /> stale
                    </Badge>
                  ) : (
                    <Badge variant="success" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" /> fresh
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {last ? (
                    <>
                      Last: {formatDateTime(last.startedAt)} ·{" "}
                      {last.recordsProcessed} rows
                    </>
                  ) : (
                    <>No successful runs yet</>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Stale after {humanMs(STALE_AFTER_MS[type])}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <ManualSyncButtons />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sync history</CardTitle>
          <p className="text-xs text-muted-foreground">
            Latest 100 sync runs across all sources. Click a row for raw error
            details.
          </p>
        </CardHeader>
        <CardContent>
          <SyncHistoryTable rows={serialized} />
        </CardContent>
      </Card>
    </div>
  );
}

function humanMs(ms: number): string {
  if (ms < 60_000) return `${ms / 1000}s`;
  if (ms < 60 * 60_000) return `${ms / 60_000}m`;
  return `${ms / (60 * 60_000)}h`;
}
