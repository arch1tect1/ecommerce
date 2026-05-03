"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

const PRESETS: { label: string; days: number }[] = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

function ymd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function DateRangeFilter({
  defaultDays = 30,
}: {
  defaultDays?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, start] = useTransition();

  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  function applyPreset(days: number) {
    const today = new Date();
    const past = new Date(today.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", ymd(past));
    params.set("to", ymd(today));
    start(() => router.replace(`${pathname}?${params.toString()}`));
  }

  function setField(key: "from" | "to", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    start(() => router.replace(`${pathname}?${params.toString()}`));
  }

  function clear() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("from");
    params.delete("to");
    start(() => router.replace(`${pathname}?${params.toString()}`));
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/30 p-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">From</label>
        <input
          type="date"
          value={from}
          onChange={(e) => setField("from", e.target.value)}
          className="h-9 rounded-md border bg-white px-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">To</label>
        <input
          type="date"
          value={to}
          onChange={(e) => setField("to", e.target.value)}
          className="h-9 rounded-md border bg-white px-2 text-sm"
        />
      </div>
      <div className="flex items-center gap-2">
        {PRESETS.map((p) => (
          <Button
            key={p.label}
            type="button"
            size="sm"
            variant={p.days === defaultDays && !from && !to ? "default" : "outline"}
            onClick={() => applyPreset(p.days)}
            disabled={pending}
          >
            {p.label}
          </Button>
        ))}
        {(from || to) && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={clear}
            disabled={pending}
          >
            Clear
          </Button>
        )}
        {pending && (
          <span className="text-xs text-muted-foreground">Loading…</span>
        )}
      </div>
    </div>
  );
}

