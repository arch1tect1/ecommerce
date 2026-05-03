import { Navbar } from "@/components/layout/navbar";

export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-1 container py-8">{children}</main>
      <footer className="border-t bg-white py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} {process.env.NEXT_PUBLIC_SITE_NAME ?? "AutoParts B2B"} — All rights reserved
      </footer>
    </div>
  );
}
