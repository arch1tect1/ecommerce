"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useRef, useTransition } from "react";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SearchBar({
  defaultQuery = "",
  defaultType = "name",
}: {
  defaultQuery?: string;
  defaultType?: "sku" | "name";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const q = (fd.get("q") as string).trim();
    const type = fd.get("type") as string;

    const params = new URLSearchParams(searchParams.toString());
    if (q) {
      params.set("q", q);
      params.set("type", type);
    } else {
      params.delete("q");
      params.delete("type");
    }
    params.delete("page"); // reset to page 1 on new search

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            name="q"
            defaultValue={defaultQuery}
            placeholder={
              defaultType === "sku"
                ? "Search by article / SKU…"
                : "Search by part name…"
            }
            className="pl-9"
          />
        </div>
        <Button type="submit" disabled={isPending} className="shrink-0">
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Search"
          )}
        </Button>
      </div>

      {/* Radio toggle */}
      <div className="flex gap-4 text-sm">
        {(["name", "sku"] as const).map((t) => (
          <label
            key={t}
            className={cn(
              "flex items-center gap-1.5 cursor-pointer",
              "text-muted-foreground hover:text-foreground transition-colors"
            )}
          >
            <input
              type="radio"
              name="type"
              value={t}
              defaultChecked={defaultType === t}
              className="accent-primary"
            />
            {t === "name" ? "Search by name" : "Search by SKU / article"}
          </label>
        ))}
      </div>
    </form>
  );
}
