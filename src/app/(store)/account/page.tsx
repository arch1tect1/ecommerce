import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ChangePasswordForm } from "./change-password-form";
import { AlertTriangle, User } from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "My Account" };

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      createdAt: true,
      lastLoginAt: true,
      customerId: true,
      customer: {
        select: {
          name: true,
          balance: true,
          creditLimit: true,
          phone: true,
          address: true,
          taxId: true,
        },
      },
    },
  });

  if (!user) redirect("/login");

  const isLinked = !!user.customerId;
  const hasDebt =
    user.customer && Number(user.customer.balance) < 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">My Account</h1>

      {/* Pending approval banner */}
      {!isLinked && user.role === "CUSTOMER" && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Account pending approval</AlertTitle>
          <AlertDescription>
            Your account has been created but is not yet linked to a customer
            record. An administrator will review and approve your account before
            you can place orders. Contact us if this takes longer than expected.
          </AlertDescription>
        </Alert>
      )}

      {/* Debt warning */}
      {hasDebt && user.customer && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Outstanding balance</AlertTitle>
          <AlertDescription>
            You have an outstanding balance of{" "}
            <strong className="font-semibold">
              {formatCurrency(user.customer.balance)}
            </strong>
            . Please contact us to settle your account.
          </AlertDescription>
        </Alert>
      )}

      {/* Profile card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile
          </CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Row label="Full name" value={user.fullName} />
          <Row label="Email" value={user.email} />
          <Row
            label="Role"
            value={
              <Badge variant="secondary">{user.role}</Badge>
            }
          />
          <Row
            label="Member since"
            value={formatDateTime(user.createdAt)}
          />
          {user.lastLoginAt && (
            <Row
              label="Last login"
              value={formatDateTime(user.lastLoginAt)}
            />
          )}
        </CardContent>
      </Card>

      {/* Customer info */}
      {user.customer && (
        <Card>
          <CardHeader>
            <CardTitle>Business account</CardTitle>
            <CardDescription>Linked customer record</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label="Company name" value={user.customer.name} />
            {user.customer.taxId && (
              <Row label="Tax ID" value={user.customer.taxId} />
            )}
            {user.customer.phone && (
              <Row label="Phone" value={user.customer.phone} />
            )}
            {user.customer.address && (
              <Row label="Address" value={user.customer.address} />
            )}
            <Row
              label="Balance"
              value={
                <span
                  className={
                    Number(user.customer.balance) < 0
                      ? "text-red-600 font-semibold"
                      : "text-green-600 font-semibold"
                  }
                >
                  {formatCurrency(user.customer.balance)}
                </span>
              }
            />
            <Row
              label="Credit limit"
              value={formatCurrency(user.customer.creditLimit)}
            />
          </CardContent>
        </Card>
      )}

      {/* Change password */}
      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>Update your login password</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
