import { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { formatDateTime, formatCurrency } from "@/lib/utils";
import { LinkCustomerDialog } from "./link-customer-dialog";
import { UnlinkButton } from "./unlink-button";
import { UserActions } from "./user-actions";

export const metadata: Metadata = { title: "Users — Admin" };
export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await auth();
  const currentUserId = session?.user?.id ?? null;
  const [users, allCustomers] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
        customerId: true,
        customer: {
          select: {
            id: true,
            name: true,
            taxId: true,
            balance: true,
            creditLimit: true,
          },
        },
      },
    }),
    prisma.customer.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, taxId: true },
    }),
  ]);

  // Customers already linked to a user
  const linkedCustomerIds = new Set(
    users.filter((u) => u.customerId).map((u) => u.customerId!)
  );

  // Only expose customers not yet linked to any user
  const availableCustomers = allCustomers.filter(
    (c) => !linkedCustomerIds.has(c.id)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {users.length} registered account{users.length !== 1 ? "s" : ""} —
          link each user to a customer record to enable order placement.
        </p>
      </div>

      <div className="rounded-lg border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last login</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="w-[260px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              // Build the list of customers available for THIS user's dialog:
              // already-available ones + the user's own currently linked customer
              // (so the "Change" flow can keep or swap)
              const dialogCustomers = user.customer
                ? [
                    { id: user.customer.id, name: user.customer.name, taxId: user.customer.taxId },
                    ...availableCustomers,
                  ]
                : availableCustomers;

              return (
                <TableRow key={user.id} className={!user.isActive ? "opacity-60" : ""}>
                  {/* User info */}
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">
                        {user.fullName}
                        {user.id === currentUserId && (
                          <span className="ml-1.5 text-[10px] text-muted-foreground">(you)</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </TableCell>

                  {/* Role */}
                  <TableCell>
                    <RoleBadge role={user.role} />
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    {user.isActive ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-gray-100 text-gray-600 text-xs">
                        Disabled
                      </Badge>
                    )}
                  </TableCell>

                  {/* Last login */}
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "—"}
                  </TableCell>

                  {/* Customer */}
                  <TableCell>
                    {user.customer ? (
                      <div>
                        <p className="text-sm font-medium">{user.customer.name}</p>
                        {user.customer.taxId && (
                          <p className="text-xs text-muted-foreground font-mono">
                            {user.customer.taxId}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">
                        Not linked
                      </span>
                    )}
                  </TableCell>

                  {/* Balance */}
                  <TableCell className="text-right text-sm">
                    {user.customer ? (
                      <span
                        className={
                          Number(user.customer.balance) < 0
                            ? "text-red-600 font-medium"
                            : "text-green-700 font-medium"
                        }
                      >
                        {formatCurrency(user.customer.balance)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Actions */}
                  <TableCell>
                    <div className="flex items-center gap-1 relative">
                      <LinkCustomerDialog
                        userId={user.id}
                        userName={user.fullName}
                        availableCustomers={dialogCustomers}
                        currentCustomerName={user.customer?.name}
                      />
                      {user.customer && (
                        <UnlinkButton userId={user.id} />
                      )}
                      <UserActions
                        userId={user.id}
                        userName={user.fullName}
                        userEmail={user.email}
                        role={user.role}
                        isActive={user.isActive}
                        isSelf={user.id === currentUserId}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { label: string; className: string }> = {
    ADMIN:    { label: "Admin",    className: "bg-red-100 text-red-800 border-red-200" },
    MANAGER:  { label: "Manager", className: "bg-orange-100 text-orange-800 border-orange-200" },
    CUSTOMER: { label: "Customer", className: "bg-blue-100 text-blue-800 border-blue-200" },
  };
  const cfg = map[role] ?? { label: role, className: "" };
  return (
    <Badge variant="outline" className={`text-xs ${cfg.className}`}>
      {cfg.label}
    </Badge>
  );
}
