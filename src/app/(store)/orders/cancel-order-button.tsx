"use client";

import { useState, useTransition } from "react";
import { cancelOrderAction } from "@/lib/actions/orders";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleCancel() {
    if (!confirm("Cancel this order? This cannot be undone.")) return;
    setError(null);
    startTransition(async () => {
      const result = await cancelOrderAction(orderId);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <>
      <Button
        size="sm"
        variant="destructive"
        onClick={handleCancel}
        disabled={pending}
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Cancel"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </>
  );
}
