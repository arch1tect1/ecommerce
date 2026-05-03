"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Props {
  categories: { id: string; name: string; slug: string }[];
  brands: string[];
}

export function ProductsFilters({ categories, brands }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(updates: Record<string, string | null>) {
    const next = new URLSearchParams(sp.toString());
    next.delete("page");
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  }

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    update({ q: (fd.get("q") as string) || null });
  }

  const activeCount =
    (sp.get("q") ? 1 : 0) +
    (sp.get("category") ? 1 : 0) +
    (sp.get("brand") ? 1 : 0) +
    (sp.get("inStock") ? 1 : 0) +
    (sp.get("status") ? 1 : 0);

  return (
    <div className="rounded-lg border bg-white p-4 space-y-3">
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={sp.get("q") ?? ""}
            placeholder="Search by SKU, name, or brand…"
            className="pl-9"
          />
        </div>
        <Button type="submit" disabled={pending}>Search</Button>
      </form>

      <div className="flex flex-wrap gap-3 text-sm items-center">
        <SelectFilter
          label="Category"
          value={sp.get("category") ?? ""}
          options={[{ value: "", label: "All" }, ...categories.map((c) => ({ value: c.slug, label: c.name }))]}
          onChange={(v) => update({ category: v || null })}
        />
        <SelectFilter
          label="Brand"
          value={sp.get("brand") ?? ""}
          options={[{ value: "", label: "All" }, ...brands.map((b) => ({ value: b, label: b }))]}
          onChange={(v) => update({ brand: v || null })}
        />
        <SelectFilter
          label="Status"
          value={sp.get("status") ?? ""}
          options={[
            { value: "", label: "All" },
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
          ]}
          onChange={(v) => update({ status: v || null })}
        />
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={sp.get("inStock") === "1"}
            onChange={(e) => update({ inStock: e.target.checked ? "1" : null })}
            className="rounded border-input"
          />
          <span>In stock only</span>
        </label>

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
