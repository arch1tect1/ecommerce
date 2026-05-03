import { Package } from "lucide-react";
import Link from "next/link";

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? "AutoParts B2B";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center p-4">
      <div className="mb-6 flex items-center gap-2">
        <Package className="h-7 w-7 text-blue-600" />
        <Link href="/" className="text-xl font-bold text-gray-900">
          {SITE_NAME}
        </Link>
      </div>
      {children}
    </div>
  );
}
