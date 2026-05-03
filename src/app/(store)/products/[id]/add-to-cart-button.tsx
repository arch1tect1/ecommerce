"use client";

import { useState, useTransition } from "react";
import { ShoppingCart, Loader2, Check } from "lucide-react";
import { addToCartAction } from "@/lib/actions/cart";
import { Button } from "@/components/ui/button";

interface AddToCartButtonProps {
  productId: string;
  stock: number;
}

export function AddToCartButton({ productId, stock }: AddToCartButtonProps) {
  const [pending, startTransition] = useTransition();
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qty, setQty] = useState(1);

  if (stock === 0) {
    return (
      <Button disabled className="flex-1">
        Out of stock
      </Button>
    );
  }

  function handleAdd() {
    setError(null);
    setAdded(false);
    startTransition(async () => {
      const result = await addToCartAction(productId, qty);
      if (result?.error) {
        setError(result.error);
      } else {
        setAdded(true);
        setTimeout(() => setAdded(false), 2000);
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {/* Quantity stepper */}
        <div className="flex items-center border rounded-md overflow-hidden">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            disabled={qty <= 1 || pending}
            className="px-3 py-2 hover:bg-muted disabled:opacity-40 transition-colors border-r"
            aria-label="Decrease"
          >
            −
          </button>
          <span className="w-10 text-center text-sm font-medium py-2">{qty}</span>
          <button
            type="button"
            onClick={() => setQty((q) => Math.min(stock, q + 1))}
            disabled={qty >= stock || pending}
            className="px-3 py-2 hover:bg-muted disabled:opacity-40 transition-colors border-l"
            aria-label="Increase"
          >
            +
          </button>
        </div>

        <Button onClick={handleAdd} disabled={pending} className="flex-1">
          {pending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : added ? (
            <Check className="mr-2 h-4 w-4" />
          ) : (
            <ShoppingCart className="mr-2 h-4 w-4" />
          )}
          {pending ? "Adding…" : added ? "Added!" : "Add to cart"}
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
