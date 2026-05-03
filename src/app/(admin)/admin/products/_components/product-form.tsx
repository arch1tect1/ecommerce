"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  createProductAction,
  updateProductAction,
} from "@/lib/actions/admin-products";

interface CategoryOption {
  id: string;
  name: string;
}

interface ProductFormProps {
  mode: "create" | "edit";
  categories: CategoryOption[];
  initial?: {
    id: string;
    sku: string;
    externalId: string;
    name: string;
    description: string | null;
    brand: string | null;
    categoryId: string | null;
    price: string;
    stock: number;
    isActive: boolean;
  };
}

export function ProductForm({ mode, categories, initial }: ProductFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [sku, setSku] = useState(initial?.sku ?? "");
  const [externalId, setExternalId] = useState(initial?.externalId ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [price, setPrice] = useState(initial?.price ?? "0");
  const [stock, setStock] = useState(String(initial?.stock ?? 0));
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  // 1C-synced products are detected by externalId NOT starting with "local-"
  const isSynced = mode === "edit" && initial && !initial.externalId.startsWith("local-");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      let res:
        | { ok: true; id?: string }
        | { ok: false; error: string };

      if (mode === "create") {
        res = await createProductAction({
          sku: sku.trim(),
          externalId: externalId.trim() || undefined,
          name: name.trim(),
          description: description.trim() || undefined,
          brand: brand.trim() || undefined,
          categoryId: categoryId || undefined,
          price: Number(price),
          stock: Number(stock),
          isActive,
        });
      } else {
        res = await updateProductAction(initial!.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          brand: brand.trim() || undefined,
          categoryId: categoryId || undefined,
          price: Number(price),
          stock: Number(stock),
          isActive,
        });
      }

      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (mode === "create" && "id" in res && res.id) {
        router.push(`/admin/products/${res.id}`);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* SKU + External ID — locked on edit (all products); editable on create */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="sku" className="flex items-center gap-1.5">
            SKU <span className="text-destructive">*</span>
            {mode === "edit" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex"><Lock className="h-3 w-3 text-muted-foreground" /></span>
                </TooltipTrigger>
                <TooltipContent>
                  {isSynced
                    ? "Synced from 1C — managed by ERP, not editable here"
                    : "Locked after creation — orders and cart items reference this SKU"}
                </TooltipContent>
              </Tooltip>
            )}
          </Label>
          <Input
            id="sku"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            readOnly={mode === "edit"}
            disabled={mode === "edit"}
            required
            placeholder="e.g. AFL-001"
            className="font-mono"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="externalId" className="flex items-center gap-1.5">
            External ID
            {mode === "edit" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex"><Lock className="h-3 w-3 text-muted-foreground" /></span>
                </TooltipTrigger>
                <TooltipContent>
                  {isSynced
                    ? "Synced from 1C — managed by ERP, not editable here"
                    : "Locked after creation — used as the join key for 1C sync"}
                </TooltipContent>
              </Tooltip>
            )}
          </Label>
          <Input
            id="externalId"
            value={externalId}
            onChange={(e) => setExternalId(e.target.value)}
            readOnly={mode === "edit"}
            disabled={mode === "edit"}
            placeholder={mode === "create" ? "(blank → auto local-…)" : ""}
            className="font-mono"
          />
          {mode === "create" && (
            <p className="text-xs text-muted-foreground">
              Leave blank for manual products. A <code className="font-mono">local-…</code> ID is generated;
              1C sync will replace it later if matched.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="name">Name <span className="text-destructive">*</span></Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="e.g. Engine Oil Filter for Toyota Corolla"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Optional product description shown on the catalog detail page."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="brand">Brand</Label>
          <Input
            id="brand"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="e.g. GENUINE PARTS"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="category">Category</Label>
          <select
            id="category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">— None —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="price">Price (AZN) <span className="text-destructive">*</span></Label>
          <Input
            id="price"
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="stock">Stock</Label>
          <Input
            id="stock"
            type="number"
            min="0"
            step="1"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="rounded border-input"
        />
        <span>Active (visible in catalog)</span>
      </label>

      <div className="flex justify-end gap-2 pt-3 border-t">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
          {mode === "create" ? "Create product" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
