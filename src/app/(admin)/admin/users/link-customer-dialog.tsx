"use client";

import { useState, useTransition } from "react";
import { Loader2, Link2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  linkUserToCustomerAction,
  createCustomerAndLinkAction,
} from "@/lib/actions/admin";

export interface AvailableCustomer {
  id: string;
  name: string;
  taxId: string | null;
}

interface Props {
  userId: string;
  userName: string;
  availableCustomers: AvailableCustomer[];
  /** If user is already linked, show "Change" mode */
  currentCustomerName?: string;
}

type Mode = "existing" | "create";

export function LinkCustomerDialog({
  userId,
  userName,
  availableCustomers,
  currentCustomerName,
}: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("existing");
  const [selectedId, setSelectedId] = useState(availableCustomers[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Create-new form state
  const [name, setName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [balance, setBalance] = useState("0");
  const [creditLimit, setCreditLimit] = useState("0");

  function resetForm() {
    setError(null);
    setName("");
    setTaxId("");
    setPhone("");
    setAddress("");
    setBalance("0");
    setCreditLimit("0");
    setSelectedId(availableCustomers[0]?.id ?? "");
    setMode("existing");
  }

  function handleLinkExisting() {
    if (!selectedId) return;
    setError(null);
    startTransition(async () => {
      const res = await linkUserToCustomerAction(userId, selectedId);
      if (res.ok) {
        setOpen(false);
        resetForm();
      } else {
        setError(res.error ?? "Something went wrong");
      }
    });
  }

  function handleCreateAndLink() {
    if (!name.trim()) {
      setError("Company name is required");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await createCustomerAndLinkAction(userId, {
        name: name.trim(),
        taxId: taxId.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        balance: parseFloat(balance) || 0,
        creditLimit: parseFloat(creditLimit) || 0,
      });
      if (res.ok) {
        setOpen(false);
        resetForm();
      } else {
        setError(res.error ?? "Something went wrong");
      }
    });
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => { resetForm(); setOpen(true); }}
      >
        {currentCustomerName ? "Change" : "Link customer"}
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!isPending) { setOpen(v); if (!v) resetForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Link customer account</DialogTitle>
            <DialogDescription>
              Link <strong>{userName}</strong> to a customer record so they can
              place orders and see their balance.
            </DialogDescription>
          </DialogHeader>

          {/* Mode toggle */}
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            <button
              type="button"
              onClick={() => { setMode("existing"); setError(null); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-sm font-medium transition-colors ${
                mode === "existing"
                  ? "bg-white shadow text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Link2 className="h-3.5 w-3.5" />
              Link existing
            </button>
            <button
              type="button"
              onClick={() => { setMode("create"); setError(null); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-sm font-medium transition-colors ${
                mode === "create"
                  ? "bg-white shadow text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <UserPlus className="h-3.5 w-3.5" />
              Create new
            </button>
          </div>

          {/* Link existing */}
          {mode === "existing" && (
            <div className="space-y-3">
              {availableCustomers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  No unlinked customers available. Use &quot;Create new&quot; to add one.
                </p>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label>Customer</Label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={selectedId}
                      onChange={(e) => setSelectedId(e.target.value)}
                    >
                      {availableCustomers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}{c.taxId ? ` (${c.taxId})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Create new */}
          {mode === "create" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="cust-name">Company name <span className="text-destructive">*</span></Label>
                <Input
                  id="cust-name"
                  placeholder="e.g. Avto Servis LLC"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cust-taxid">Tax ID (VÖEN)</Label>
                  <Input
                    id="cust-taxid"
                    placeholder="1234567890"
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cust-phone">Phone</Label>
                  <Input
                    id="cust-phone"
                    placeholder="+994 50 000 0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cust-address">Address</Label>
                <Input
                  id="cust-address"
                  placeholder="Baku, Azerbaijan"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cust-balance">Opening balance (₼)</Label>
                  <Input
                    id="cust-balance"
                    type="number"
                    step="0.01"
                    value={balance}
                    onChange={(e) => setBalance(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cust-credit">Credit limit (₼)</Label>
                  <Input
                    id="cust-credit"
                    type="number"
                    step="0.01"
                    min="0"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setOpen(false); resetForm(); }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={mode === "existing" ? handleLinkExisting : handleCreateAndLink}
              disabled={isPending || (mode === "existing" && !selectedId)}
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "existing" ? "Link" : "Create & link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
