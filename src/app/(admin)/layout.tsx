import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { AdminHeader } from "./admin/layout-header";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-h-screen bg-gray-100">
        <AdminSidebar />
        <div className="ml-60 flex-1 flex flex-col min-h-screen">
          <AdminHeader />
          <main className="flex-1 p-8">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
