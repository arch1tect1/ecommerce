/**
 * Edge-compatible NextAuth config — no Node.js APIs, no Prisma, no bcrypt.
 * Used by middleware.ts which runs on the Edge runtime.
 * The full credentials provider (with bcrypt + Prisma) lives in auth.ts.
 */
import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const role = auth?.user?.role;

      if (nextUrl.pathname.startsWith("/admin")) {
        if (!isLoggedIn) return false;
        return role === "ADMIN" || role === "MANAGER";
      }

      const protectedRoutes = ["/cart", "/orders", "/account"];
      const isProtected = protectedRoutes.some((r) =>
        nextUrl.pathname.startsWith(r)
      );
      if (isProtected && !isLoggedIn) return false;

      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.role = (user as any).role;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.customerId = (user as any).customerId ?? null;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        session.user.role = token.role as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        session.user.customerId = token.customerId as any;
      }
      return session;
    },
  },
  providers: [],
  session: { strategy: "jwt" },
};
