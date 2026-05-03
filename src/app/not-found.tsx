import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SearchX } from "lucide-react";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-md space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-600">
          <SearchX className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Page not found</h1>
        <p className="text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex justify-center gap-2 pt-2">
          <Button asChild>
            <Link href="/">Browse catalog</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/orders">My orders</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
