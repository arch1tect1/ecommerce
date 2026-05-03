"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  FolderTree,
  ShoppingBag,
  Users,
  UserCog,
  BarChart3,
  RefreshCw,
  Package2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? "AutoParts B2B";

const navItems = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/users", label: "Users", icon: UserCog },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/sync", label: "1C Sync", icon: RefreshCw },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 w-60 bg-gray-900 text-white flex flex-col">
      {/* Brand */}
      <div className="flex items-center gap-2 px-6 py-5 border-b border-gray-700">
        <Package2 className="h-6 w-6 text-blue-400" />
        <span className="font-bold text-sm truncate">{SITE_NAME}</span>
        <span className="ml-auto text-[10px] bg-blue-600 text-white rounded px-1.5 py-0.5">
          ADMIN
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const active = exact
            ? pathname === href
            : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-700 px-6 py-4">
        <Link
          href="/"
          className="text-xs text-gray-400 hover:text-white transition-colors"
        >
          ← Back to store
        </Link>
      </div>
    </aside>
  );
}
