"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { manualSyncAction, type ManualSyncResult } from "../actions";
import { SYNC_TYPES, type SyncType } from "@/lib/sync";

const LABELS: Record<SyncType, string> = {
  products: "Products",
  stock: "Stock",
  prices: "Prices",
  categories: "Categories",
  customers: "Customers",
};

export function ManualSyncButtons() {
  const [pending, start] = useTransition();
  const [active, setActive] = useState<SyncType | null>(null);
  const [results, setResults] = useState<Record<SyncType, ManualSyncResult | null>>(() => {
    const obj: Partial<Record<SyncType, ManualSyncResult | null>> = {};
    for (const t of SYNC_TYPES) obj[t] = null;
    return obj as Record<SyncType, ManualSyncResult | null>;
  });

  function trigger(type: SyncType) {
    setActive(type);
    start(async () => {
      const result = await manualSyncAction(type);
      setResults((r) => ({ ...r, [type]: result }));
      setActive(null);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <RefreshCw className="h-4 w-4" /> Manual sync
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Triggers the same pull logic the cron uses. If <code>ONEC_PULL_URL</code> is
          not set, a SKIPPED SyncLog row is recorded so you can verify the pipeline.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {SYNC_TYPES.map((type) => {
            const r = results[type];
            const busy = pending && active === type;
            return (
              <div key={type} className="flex flex-col gap-2 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{LABELS[type]}</span>
                  {r && <ResultBadge status={r.status} />}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => trigger(type)}
                  disabled={pending}
                >
                  {busy ? (
                    <>
                      <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
                      Syncing…
                    </>
                  ) : (
                    "Sync now"
                  )}
                </Button>
                {r && (
                  <div className="text-[11px] text-muted-foreground">
                    {r.processed} processed · {r.failed} failed
                  </div>
                )}
                {r?.message && (
                  <div className="rounded border border-blue-200 bg-blue-50 p-2 text-[11px] text-blue-800">
                    <Info className="mr-1 inline h-3 w-3" />
                    {r.message}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function ResultBadge({ status }: { status: string }) {
  if (status === "SUCCESS")
    return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (status === "PARTIAL")
    return <AlertCircle className="h-4 w-4 text-yellow-600" />;
  if (status === "SKIPPED")
    return <Info className="h-4 w-4 text-blue-600" />;
  return <AlertCircle className="h-4 w-4 text-red-600" />;
}
