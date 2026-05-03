"use client";

import { useTransition } from "react";
import { Loader2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { unlinkUserFromCustomerAction } from "@/lib/actions/admin";

export function UnlinkButton({ userId }: { userId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleUnlink() {
    if (!confirm("Remove the link between this user and their customer record?")) return;
    startTransition(async () => {
      await unlinkUserFromCustomerAction(userId);
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleUnlink}
      disabled={isPending}
      className="text-muted-foreground hover:text-destructive"
      title="Unlink from customer"
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Unlink className="h-4 w-4" />
      )}
    </Button>
  );
}
