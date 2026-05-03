"use client";

import { useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function OrdersFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(updates: Record<string, string | null>) {
    const next = new URLSearchParams(sp.toString());
    next.delete("page");
    for (const [k, v] of Object.entries(updates)) {
      if (!v) next.delete(k);
      else next.set(k, v);
    }
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  }

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    update({ q: (fd.get("q") as string) || null });
  }

  const activeCount = ["q", "status", "payment", "from", "to"].filter((k) => sp.get(k)).length;

  return (
    <div className="rounded-lg border bg-white p-4 space-y-3">
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={sp.get("q") ?? ""}
            placeholder="Search by order #, customer name, or tax ID…"
            className="pl-9"
          />
        </div>
        <Button type="submit" disabled={pending}>Search</Button>
      </form>

      <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm items-end">
        <SelectFilter
          label="Status"
          value={sp.get("status") ?? ""}
          options={[
            { value: "", label: "All" },
            { value: "PENDING", label: "Pending" },
            { value: "COMPLETED", label: "Completed" },
            { value: "CANCELLED", label: "Cancelled" },
          ]}
          onChange={(v) => update({ status: v || null })}
        />
        <SelectFilter
          label="Payment"
          value={sp.get("payment") ?? ""}
          options={[
            { value: "", label: "All" },
            { value: "UNPAID", label: "Unpaid" },
            { value: "PARTIAL", label: "Partial" },
            { value: "PAID", label: "Paid" },
          ]}
          onChange={(v) => update({ payment: v || null })}
        />
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="date-from" className="text-xs text-muted-foreground">From</Label>
            <Input
              id="date-from"
              type="date"
              defaultValue={sp.get("from") ?? ""}
              onChange={(e) => update({ from: e.target.value || null })}
              className="h-8 w-auto"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="date-to" className="text-xs text-muted-foreground">To</Label>
            <Input
              id="date-to"
              type="date"
              defaultValue={sp.get("to") ?? ""}
              onChange={(e) => update({ to: e.target.value || null })}
              className="h-8 w-auto"
            />
          </div>
        </div>

        {activeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => startTransition(() => router.push(pathname))}
            className="ml-auto"
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}

function SelectFilter({
  label, value, options, onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="inline-flex items-center gap-1.5">
      <span className="text-muted-foreground">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-input bg-background px-2 py-1 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}
