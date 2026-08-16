import { Outlet } from "react-router-dom";

import { AppSidebar } from "./app-sidebar";
import { ThemeToggle } from "./theme-toggle";
import { OnboardingBanner } from "@/features/onboarding/components/OnboardingBanner";
import { VerifyEmailBanner } from "@/features/auth/components/VerifyEmailBanner";
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
      <SidebarInset className="min-h-0 min-w-0">
        <TourBoot />
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>
        <main className="min-h-0 min-w-0 flex-1 overflow-auto p-4 lg:p-6">
          <VerifyEmailBanner />
          <OnboardingBanner />
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
