import { Outlet, useLocation } from "react-router-dom";

import { AppSidebar } from "./app-sidebar";
import { ThemeToggle } from "./theme-toggle";
import { OnboardingBanner } from "@/features/onboarding/components/OnboardingBanner";
import { TourBoot } from "@/features/tour/TourBoot";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

function getScreenTitle(pathname: string): string {
  const path = pathname.replace(/\/+$/, "");
  if (path === "" || path === "/dashboard") return "Dashboard";
  if (path === "/students") return "Students";
  if (path.startsWith("/students/")) return "Student Details";
  if (path === "/schedule") return "Schedule";
  if (path === "/payments") return "Payments";
  if (path === "/payments/new") return "New Invoice";
  if (path.match(/^\/payments\/[^/]+\/edit$/)) return "Edit Invoice";
  if (path.startsWith("/payments/")) return "Invoice";
  if (path === "/lessons") return "Lessons";
  if (path.startsWith("/lessons/")) return "Event Details";
  if (path === "/settings/payments") return "Payment Settings";
  if (path === "/settings") return "Settings";
  if (path === "/account") return "Account";
  if (path === "/admin/feedback") return "Feedback";
  if (path === "/admin/tutors") return "Tutors";
  if (path === "/profile") return "Profile";
  return "Clastor";
}

export function DashboardLayout() {
  const { pathname } = useLocation();
  return (
    <SidebarProvider className="h-svh">
      <AppSidebar />
      <SidebarInset className="min-h-0">
        <TourBoot />
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <h1 className="text-sm font-semibold">{getScreenTitle(pathname)}</h1>
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
