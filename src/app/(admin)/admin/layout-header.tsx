import { auth } from "@/auth";
import { logoutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export async function AdminHeader() {
  const session = await auth();
  return (
    <header className="h-14 border-b bg-white flex items-center justify-between px-8 shrink-0">
      <div />
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">
          {session?.user?.name ?? session?.user?.email}
        </span>
        <form action={logoutAction}>
          <Button variant="ghost" size="sm" type="submit">
            <LogOut className="h-4 w-4 mr-1.5" />
            Sign out
          </Button>
        </form>
      </div>
    </header>
  );
}
