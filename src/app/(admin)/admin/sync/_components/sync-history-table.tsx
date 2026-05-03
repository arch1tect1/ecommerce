"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

export interface SerializedSyncLog {
  id: string;
  source: string;
  syncType: string;
  status: string;
  recordsProcessed: number;
  recordsFailed: number;
  errorDetails: unknown;
  startedAt: string;
  finishedAt: string | null;
}

export function SyncHistoryTable({ rows }: { rows: SerializedSyncLog[] }) {
  const [openLog, setOpenLog] = useState<SerializedSyncLog | null>(null);

  return (
    <>
      <div className="overflow-hidden rounded-md border">
        <div className="max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Processed</th>
                <th className="px-3 py-2 text-right">Failed</th>
                <th className="px-3 py-2">Started</th>
                <th className="px-3 py-2">Duration</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-8 text-center text-muted-foreground"
                  >
                    No sync runs recorded yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setOpenLog(row)}
                    className="cursor-pointer border-t hover:bg-muted/40"
                  >
                    <td className="px-3 py-2 font-medium">{row.syncType}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                      {row.source}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.recordsProcessed}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.recordsFailed > 0 ? (
                        <span className="text-red-600">
                          {row.recordsFailed}
                        </span>
                      ) : (
                        row.recordsFailed
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {formatDateTime(row.startedAt)}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {durationOf(row)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!openLog} onOpenChange={(o) => !o && setOpenLog(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Sync log — {openLog?.syncType} ·{" "}
              <span className="font-mono text-sm">{openLog?.id}</span>
            </DialogTitle>
          </DialogHeader>
          {openLog && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div>
                  <div className="text-xs text-muted-foreground">Source</div>
                  <div className="font-mono">{openLog.source}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Status</div>
                  <StatusBadge status={openLog.status} />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Processed</div>
                  <div>{openLog.recordsProcessed}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Failed</div>
                  <div>{openLog.recordsFailed}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Started</div>
                  <div>{formatDateTime(openLog.startedAt)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Finished</div>
                  <div>
                    {openLog.finishedAt
                      ? formatDateTime(openLog.finishedAt)
                      : "—"}
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-muted-foreground">Duration</div>
                  <div>{durationOf(openLog)}</div>
                </div>
              </div>

              <div>
                <div className="mb-1 text-xs text-muted-foreground">
                  Error details (max 100 entries)
                </div>
                <pre className="max-h-80 overflow-auto rounded-md border bg-gray-50 p-3 text-xs">
                  {openLog.errorDetails
                    ? JSON.stringify(openLog.errorDetails, null, 2)
                    : "(none)"}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "SUCCESS":
      return <Badge variant="success">SUCCESS</Badge>;
    case "PARTIAL":
      return <Badge variant="warning">PARTIAL</Badge>;
    case "FAILED":
      return <Badge variant="destructive">FAILED</Badge>;
    case "SKIPPED":
      return <Badge variant="secondary">SKIPPED</Badge>;
    case "RUNNING":
      return <Badge variant="default">RUNNING</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function durationOf(row: SerializedSyncLog): string {
  if (!row.finishedAt) return "running…";
  const ms = new Date(row.finishedAt).getTime() - new Date(row.startedAt).getTime();
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  const m = Math.floor(s / 60);
  const rs = Math.round(s % 60);
  return `${m}m ${rs}s`;
}
