"use client";

import { useState, useTransition } from "react";
import { Loader2, KeyRound, ShieldCheck, ShieldAlert, UserX, UserCheck, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  updateUserRoleAction,
  setUserActiveAction,
  resetUserPasswordAction,
} from "@/lib/actions/admin";
import type { Role } from "@prisma/client";

interface Props {
  userId: string;
  userName: string;
  userEmail: string;
  role: Role;
  isActive: boolean;
  isSelf: boolean;
}

export function UserActions({ userId, userName, userEmail, role, isActive, isSelf }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<{ password: string; copied: boolean } | null>(null);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [pendingRole, setPendingRole] = useState<Role>(role);

  function handleSetActive() {
    if (isSelf) return;
    const action = isActive ? "deactivate" : "activate";
    if (!confirm(`Are you sure you want to ${action} ${userName}?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await setUserActiveAction(userId, !isActive);
      if (!res.ok) setError(res.error ?? "Failed");
    });
  }

  function handleRoleSubmit() {
    if (pendingRole === role) { setShowRoleDialog(false); return; }
    setError(null);
    startTransition(async () => {
      const res = await updateUserRoleAction(userId, pendingRole);
      if (!res.ok) {
        setError(res.error ?? "Failed");
      } else {
        setShowRoleDialog(false);
      }
    });
  }

  function handleResetPassword() {
    if (!confirm(`Generate a new temporary password for ${userName}? The old password will stop working immediately.`)) return;
    setError(null);
    startTransition(async () => {
      const res = await resetUserPasswordAction(userId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResetResult({ password: res.tempPassword, copied: false });
    });
  }

  async function copyPassword() {
    if (!resetResult) return;
    try {
      await navigator.clipboard.writeText(resetResult.password);
      setResetResult({ ...resetResult, copied: true });
      setTimeout(() => setResetResult((r) => (r ? { ...r, copied: false } : null)), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      {error && (
        <div className="absolute right-4 mt-1 max-w-[260px] z-10">
          <Alert variant="destructive" className="text-xs py-2">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => { setPendingRole(role); setShowRoleDialog(true); }}
          disabled={pending}
          title="Change role"
          className="text-muted-foreground"
        >
          {role === "ADMIN" ? <ShieldAlert className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={handleResetPassword}
          disabled={pending}
          title="Reset password"
          className="text-muted-foreground"
        >
          <KeyRound className="h-4 w-4" />
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={handleSetActive}
          disabled={pending || isSelf}
          title={isActive ? "Deactivate user" : "Activate user"}
          className={`${isActive ? "text-muted-foreground hover:text-destructive" : "text-green-600"} ${isSelf ? "opacity-30" : ""}`}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isActive ? (
            <UserX className="h-4 w-4" />
          ) : (
            <UserCheck className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Role change dialog */}
      <Dialog open={showRoleDialog} onOpenChange={(v) => { if (!pending) setShowRoleDialog(v); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Change role</DialogTitle>
            <DialogDescription>
              Update the role for <strong>{userName}</strong> ({userEmail}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {(["CUSTOMER", "MANAGER", "ADMIN"] as const).map((r) => (
              <label key={r} className="flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/30">
                <input
                  type="radio"
                  name="role"
                  value={r}
                  checked={pendingRole === r}
                  onChange={() => setPendingRole(r)}
                />
                <div className="flex-1">
                  <div className="text-sm font-medium">{r}</div>
                  <div className="text-xs text-muted-foreground">
                    {r === "ADMIN"   ? "Full access to admin panel and all data."
                    : r === "MANAGER" ? "Admin panel access; can manage products, orders, customers."
                    : "Standard customer — can browse catalog and place orders."}
                  </div>
                </div>
              </label>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoleDialog(false)} disabled={pending}>Cancel</Button>
            <Button onClick={handleRoleSubmit} disabled={pending || pendingRole === role}>
              {pending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Temp password reveal dialog */}
      <Dialog
        open={!!resetResult}
        onOpenChange={(v) => { if (!v) setResetResult(null); }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Temporary password generated</DialogTitle>
            <DialogDescription>
              Share this password with <strong>{userName}</strong> via a secure channel. It will not be shown again.
            </DialogDescription>
          </DialogHeader>

          {resetResult && (
            <div className="space-y-3">
              <div className="rounded-md border bg-amber-50 border-amber-200 p-3 flex items-center gap-2">
                <code className="font-mono text-sm flex-1 select-all">{resetResult.password}</code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyPassword}
                  className="shrink-0"
                >
                  {resetResult.copied ? (
                    <><Check className="h-3.5 w-3.5 mr-1 text-green-600" /> Copied</>
                  ) : (
                    <><Copy className="h-3.5 w-3.5 mr-1" /> Copy</>
                  )}
                </Button>
              </div>
              <Alert>
                <AlertDescription className="text-xs">
                  The user&apos;s previous password no longer works. Ask them to log in with this temporary password and change it from the Account page.
                </AlertDescription>
              </Alert>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setResetResult(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
