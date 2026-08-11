import { Outlet } from "react-router-dom";

import { AppSidebar } from "./app-sidebar";
import { ThemeToggle } from "./theme-toggle";
import { OnboardingBanner } from "@/features/onboarding/components/OnboardingBanner";
import { TourBoot } from "@/features/tour/TourBoot";
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
        <TourBoot />
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 min-h-0 overflow-auto p-4 lg:p-6">
          <OnboardingBanner />
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
