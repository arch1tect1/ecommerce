"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { Trash2, Minus, Plus, Loader2, ShoppingBag, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  updateCartItemAction,
  removeCartItemAction,
} from "@/lib/actions/cart";
import { createOrderAction } from "@/lib/actions/orders";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";
import { Package } from "lucide-react";
import type { SerializedCartItem } from "@/lib/serialize";
import { Decimal } from "decimal.js";

interface CartItemsProps {
  items: SerializedCartItem[];
  isLinked: boolean;
}

export function CartItems({ items, isLinked }: CartItemsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutPending, setCheckoutPending] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const grandTotal = items.reduce((sum, item) => {
    return sum.plus(new Decimal(item.priceSnapshot).times(item.quantity));
  }, new Decimal(0));

  function handleQtyChange(itemId: string, newQty: number) {
    startTransition(async () => {
      await updateCartItemAction(itemId, newQty);
    });
  }

  function handleRemove(itemId: string) {
    setRemovingId(itemId);
    startTransition(async () => {
      await removeCartItemAction(itemId);
      setRemovingId(null);
    });
  }

  async function handleCheckout() {
    setCheckoutError(null);
    setCheckoutPending(true);
    const result = await createOrderAction();
    setCheckoutPending(false);
    if (!result.ok) {
      setCheckoutError(result.error);
      return;
    }
    router.push(`/orders/${result.orderId}`);
  }

  return (
    <div className="space-y-4">
      {/* Cart table */}
      <div className="rounded-lg border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">Product</TableHead>
              <TableHead className="text-center">Unit price</TableHead>
              <TableHead className="text-center">Qty</TableHead>
              <TableHead className="text-right">Line total</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const lineTotal = new Decimal(item.priceSnapshot).times(item.quantity);
              const isRemoving = removingId === item.id;
              const stockWarning = item.quantity > item.product.stock;

              return (
                <TableRow
                  key={item.id}
                  className={isRemoving ? "opacity-40 pointer-events-none" : ""}
                >
                  {/* Product */}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded border bg-gray-50 shrink-0 overflow-hidden relative">
                        {item.product.images[0]?.url ? (
                          <Image
                            src={item.product.images[0].url}
                            alt={item.product.name}
                            fill
                            sizes="48px"
                            className="object-contain p-1"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <Package className="h-5 w-5 text-gray-300" />
                          </div>
                        )}
                      </div>
                      <div>
                        <Link
                          href={`/products/${item.productId}`}
                          className="font-medium text-sm hover:text-primary transition-colors line-clamp-1"
                        >
                          {item.product.name}
                        </Link>
                        <p className="text-xs text-muted-foreground font-mono">
                          {item.product.sku}
                        </p>
                        {stockWarning && (
                          <p className="text-xs text-orange-600 flex items-center gap-1 mt-0.5">
                            <AlertTriangle className="h-3 w-3" />
                            Only {item.product.stock} in stock
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  {/* Unit price */}
                  <TableCell className="text-center text-sm">
                    {formatCurrency(item.priceSnapshot)}
                  </TableCell>

                  {/* Qty stepper */}
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleQtyChange(item.id, item.quantity - 1)}
                        disabled={pending || item.quantity <= 1}
                        className="h-7 w-7 rounded border flex items-center justify-center hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-8 text-center text-sm font-medium">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => handleQtyChange(item.id, item.quantity + 1)}
                        disabled={pending || item.quantity >= item.product.stock}
                        className="h-7 w-7 rounded border flex items-center justify-center hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </TableCell>

                  {/* Line total */}
                  <TableCell className="text-right font-semibold text-sm">
                    {formatCurrency(lineTotal)}
                  </TableCell>

                  {/* Remove */}
                  <TableCell>
                    <button
                      onClick={() => handleRemove(item.id)}
                      disabled={pending}
                      className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
                      aria-label="Remove item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Summary + checkout */}
      <div className="flex justify-end">
        <div className="w-full sm:w-80 space-y-4 rounded-lg border bg-white p-5">
          <h2 className="font-semibold">Order summary</h2>

          <div className="space-y-2 text-sm">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between text-muted-foreground">
                <span className="truncate max-w-[180px]">
                  {item.product.name} × {item.quantity}
                </span>
                <span>
                  {formatCurrency(
                    new Decimal(item.priceSnapshot).times(item.quantity)
                  )}
                </span>
              </div>
            ))}
          </div>

          <Separator />

          <div className="flex justify-between font-bold text-base">
            <span>Total</span>
            <span>{formatCurrency(grandTotal)}</span>
          </div>

          {!isLinked && (
            <Alert variant="warning">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Your account is not yet approved. An administrator must link it to a customer record before you can place orders.
              </AlertDescription>
            </Alert>
          )}

          {checkoutError && (
            <Alert variant="destructive">
              <AlertDescription className="text-xs">{checkoutError}</AlertDescription>
            </Alert>
          )}

          <Button
            className="w-full"
            onClick={handleCheckout}
            disabled={checkoutPending || !isLinked || pending}
          >
            {checkoutPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Placing order…
              </>
            ) : (
              <>
                <ShoppingBag className="mr-2 h-4 w-4" />
                Place order
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
