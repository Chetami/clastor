import { Outlet } from "react-router-dom";

import { AppSidebar } from "./app-sidebar";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export function DashboardLayout() {
  return (
    <SidebarProvider className="h-svh">
      <AppSidebar />
      <SidebarInset className="min-h-0">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <h1 className="text-sm font-semibold">Examify TMS</h1>
        </header>
        <main className="flex-1 min-h-0 overflow-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
