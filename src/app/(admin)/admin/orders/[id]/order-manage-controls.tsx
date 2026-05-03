"use client";

import { useState, useTransition } from "react";
import { Loader2, CheckCircle2, XCircle, Clock, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  updateOrderStatusAction,
  updateOrderPaidAction,
  updateOrderNotesAction,
} from "@/lib/actions/admin-orders";
import type { OrderStatus } from "@prisma/client";

interface Props {
  orderId: string;
  status: OrderStatus;
  paid: string;
  total: string;
  notes: string;
}

export function OrderManageControls({ orderId, status: initialStatus, paid: initialPaid, total, notes: initialNotes }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [status, setStatus] = useState<OrderStatus>(initialStatus);
  const [paid, setPaid] = useState(initialPaid);
  const [notes, setNotes] = useState(initialNotes);

  function flash(msg: string) {
    setSuccess(msg);
    setError(null);
    setTimeout(() => setSuccess(null), 2000);
  }

  function handleStatusChange(newStatus: OrderStatus) {
    if (newStatus === status) return;
    if (newStatus === "CANCELLED" && !confirm("Cancel this order? Stock is not automatically restored.")) return;
    setError(null);
    startTransition(async () => {
      const res = await updateOrderStatusAction(orderId, newStatus);
      if (!res.ok) { setError(res.error); return; }
      setStatus(newStatus);
      flash("Status updated");
    });
  }

  function handlePaidSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await updateOrderPaidAction(orderId, Number(paid));
      if (!res.ok) { setError(res.error); return; }
      flash(`Payment recorded — status now ${res.paymentStatus}`);
    });
  }

  function handleNotesSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await updateOrderNotesAction(orderId, notes);
      if (!res.ok) { setError(res.error); return; }
      flash("Notes saved");
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">
          Manage
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && (
          <Alert variant="destructive">
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert>
            <AlertDescription className="text-xs text-green-700">{success}</AlertDescription>
          </Alert>
        )}

        {/* Status */}
        <div className="space-y-2">
          <Label className="text-xs uppercase text-muted-foreground tracking-wide">Order status</Label>
          <div className="grid grid-cols-3 gap-1">
            <StatusButton
              icon={Clock}
              label="Pending"
              active={status === "PENDING"}
              onClick={() => handleStatusChange("PENDING")}
              disabled={pending}
              activeClass="bg-amber-100 border-amber-300 text-amber-800"
            />
            <StatusButton
              icon={CheckCircle2}
              label="Completed"
              active={status === "COMPLETED"}
              onClick={() => handleStatusChange("COMPLETED")}
              disabled={pending}
              activeClass="bg-green-100 border-green-300 text-green-800"
            />
            <StatusButton
              icon={XCircle}
              label="Cancelled"
              active={status === "CANCELLED"}
              onClick={() => handleStatusChange("CANCELLED")}
              disabled={pending}
              activeClass="bg-red-100 border-red-300 text-red-800"
            />
          </div>
        </div>

        {/* Payment */}
        <form onSubmit={handlePaidSubmit} className="space-y-2">
          <Label htmlFor="paid" className="text-xs uppercase text-muted-foreground tracking-wide">
            Paid amount (max {total})
          </Label>
          <div className="flex gap-2">
            <Input
              id="paid"
              type="number"
              min="0"
              step="0.01"
              value={paid}
              onChange={(e) => setPaid(e.target.value)}
              disabled={pending}
            />
            <Button type="submit" disabled={pending} size="sm">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Payment status is auto-derived: 0 → Unpaid · partial → Partial · full → Paid.
          </p>
        </form>

        {/* Notes */}
        <form onSubmit={handleNotesSubmit} className="space-y-2">
          <Label htmlFor="notes" className="text-xs uppercase text-muted-foreground tracking-wide">
            Internal notes
          </Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Visible to admins only…"
            disabled={pending}
          />
          <Button type="submit" disabled={pending} size="sm" className="w-full">
            {pending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Save notes
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function StatusButton({
  icon: Icon, label, active, onClick, disabled, activeClass,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
  disabled: boolean;
  activeClass: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || active}
      className={`flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-xs font-medium transition-colors disabled:cursor-default ${
        active
          ? activeClass
          : "border-input hover:bg-muted text-muted-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
