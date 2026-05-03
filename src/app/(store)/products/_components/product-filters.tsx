"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SlidersHorizontal, X } from "lucide-react";

interface ProductFiltersProps {
  categories: { id: string; name: string; slug: string }[];
  brands: string[];
  currentCategory?: string;
  currentBrand?: string;
  currentInStock?: boolean;
  currentSort?: string;
}

const SORT_OPTIONS = [
  { value: "name_asc",   label: "Name A→Z"   },
  { value: "name_desc",  label: "Name Z→A"   },
  { value: "price_asc",  label: "Price low→high" },
  { value: "price_desc", label: "Price high→low" },
];

export function ProductFilters({
  categories,
  brands,
  currentCategory,
  currentBrand,
  currentInStock,
  currentSort,
}: ProductFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function update(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  function clearAll() {
    const params = new URLSearchParams();
    const q = searchParams.get("q");
    const type = searchParams.get("type");
    if (q) params.set("q", q);
    if (type) params.set("type", type);
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  const hasFilters = !!(currentCategory || currentBrand || currentInStock);

  return (
    <aside className="w-full space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm flex items-center gap-1.5">
          <SlidersHorizontal className="h-4 w-4" />
          Filters
        </h2>
        {hasFilters && (
          <button
            onClick={clearAll}
            className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>

      {/* Sort */}
      <FilterSection label="Sort by">
        <div className="space-y-1">
          {SORT_OPTIONS.map((opt) => (
            <FilterRadio
              key={opt.value}
              label={opt.label}
              checked={currentSort === opt.value || (!currentSort && opt.value === "name_asc")}
              onClick={() => update("sort", opt.value === "name_asc" ? null : opt.value)}
            />
          ))}
        </div>
      </FilterSection>

      {/* Category */}
      <FilterSection label="Category">
        <div className="space-y-1">
          <FilterRadio
            label="All categories"
            checked={!currentCategory}
            onClick={() => update("category", null)}
          />
          {categories.map((cat) => (
            <FilterRadio
              key={cat.id}
              label={cat.name}
              checked={currentCategory === cat.slug}
              onClick={() => update("category", currentCategory === cat.slug ? null : cat.slug)}
            />
          ))}
        </div>
      </FilterSection>

      {/* Brand */}
      {brands.length > 0 && (
        <FilterSection label="Brand">
          <div className="flex flex-wrap gap-1.5">
            {brands.map((b) => (
              <button
                key={b}
                onClick={() => update("brand", currentBrand === b ? null : b)}
                className="focus:outline-none"
              >
                <Badge
                  variant={currentBrand === b ? "default" : "outline"}
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  {b}
                </Badge>
              </button>
            ))}
          </div>
        </FilterSection>
      )}

      {/* In stock only */}
      <FilterSection label="Availability">
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input
            type="checkbox"
            checked={!!currentInStock}
            onChange={(e) => update("inStock", e.target.checked ? "1" : null)}
            className="rounded accent-primary"
          />
          In stock only
        </label>
      </FilterSection>
    </aside>
  );
}

function FilterSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">
        {label}
      </Label>
      {children}
    </div>
  );
}

function FilterRadio({
  label,
  checked,
  onClick,
}: {
  label: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left px-2 py-1 rounded text-sm transition-colors",
        checked
          ? "bg-primary text-primary-foreground font-medium"
          : "hover:bg-muted text-foreground"
      )}
    >
      {label}
    </button>
  );
}
