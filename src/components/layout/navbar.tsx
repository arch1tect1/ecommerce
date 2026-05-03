import Link from "next/link";
import { ShoppingCart, Package, LogOut, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { auth } from "@/auth";
import { logoutAction } from "@/lib/actions/auth";
import { getCartItemCount } from "@/lib/data/cart";

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? "AutoParts B2B";

export async function Navbar() {
  const session = await auth();
  const user = session?.user;

  // Fetch cart count for logged-in users (non-blocking)
  const cartCount = user ? await getCartItemCount(user.id).catch(() => 0) : 0;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white shadow-sm">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Package className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold text-gray-900">{SITE_NAME}</span>
        </Link>

        {/* Main nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <Link
            href="/products"
            className="text-gray-600 hover:text-primary transition-colors"
          >
            Catalog
          </Link>
          {user && (
            <>
              <Link
                href="/orders"
                className="text-gray-600 hover:text-primary transition-colors"
              >
                Orders
              </Link>
              <Link
                href="/account"
                className="text-gray-600 hover:text-primary transition-colors"
              >
                Account
              </Link>
            </>
          )}
          {(user?.role === "ADMIN" || user?.role === "MANAGER") && (
            <Link
              href="/admin"
              className="text-blue-600 hover:text-blue-800 transition-colors font-semibold"
            >
              Admin
            </Link>
          )}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <span className="hidden sm:block text-sm text-muted-foreground truncate max-w-[160px]">
                {user.name}
              </span>

              {/* Cart with badge */}
              <Button variant="ghost" size="icon" asChild className="relative">
                <Link href="/cart" aria-label={`Cart (${cartCount} items)`}>
                  <ShoppingCart className="h-5 w-5" />
                  {cartCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center leading-none">
                      {cartCount > 9 ? "9+" : cartCount}
                    </span>
                  )}
                </Link>
              </Button>

              {(user.role === "ADMIN" || user.role === "MANAGER") && (
                <Button variant="ghost" size="icon" asChild>
                  <Link href="/admin" aria-label="Admin panel">
                    <LayoutDashboard className="h-5 w-5" />
                  </Link>
                </Button>
              )}
              <form action={logoutAction}>
                <Button variant="ghost" size="icon" type="submit" aria-label="Sign out">
                  <LogOut className="h-5 w-5" />
                </Button>
              </form>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/register">Register</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
