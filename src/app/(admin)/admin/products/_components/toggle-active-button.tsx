"use client";

import { useTransition } from "react";
import { Loader2, EyeOff, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setProductActiveAction } from "@/lib/actions/admin-products";

export function ToggleActiveButton({
  id,
  isActive,
}: {
  id: string;
  isActive: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    if (isActive && !confirm("Deactivate this product? It will be hidden from the catalog.")) return;
    startTransition(async () => {
      await setProductActiveAction(id, !isActive);
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleToggle}
      disabled={pending}
      title={isActive ? "Deactivate" : "Activate"}
      className="text-muted-foreground"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isActive ? (
        <EyeOff className="h-4 w-4" />
      ) : (
        <Eye className="h-4 w-4" />
      )}
    </Button>
  );
}
