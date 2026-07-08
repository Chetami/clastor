import { Link, useLocation } from "react-router-dom";
import { useState } from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { navItems } from "@/config/nav";
import { useAuth } from "@/hooks/use-auth";
import { NavUser } from "./nav-user";
import { OrgSwitcher } from "./org-switcher";
import { FeedbackDialog } from "@/features/feedback/FeedbackDialog";
import { useListFeedback } from "@/features/feedback/api";

const FEEDBACK_HREF = "/admin/feedback";

function FeedbackOpenCount() {
  const { data: feedback = [] } = useListFeedback();
  const openCount = feedback.filter((f) => f.status === "open").length;
  if (openCount === 0) return null;
  return <SidebarMenuBadge>{openCount}</SidebarMenuBadge>;
}

export function AppSidebar() {
  const location = useLocation();
  const { user } = useAuth();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const items = navItems.filter(
    (item) =>
      (!item.roles || (user?.role && item.roles.includes(user.role))) &&
      (!item.orgOnly || !!user?.currentOrgId),
  );

  return (
    <>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader>
          <OrgSwitcher />
        </SidebarHeader>

        <SidebarSeparator />

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Menu</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname === item.href}
                      tooltip={item.title}
                    >
                      <Link to={item.href}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                    {item.href === FEEDBACK_HREF && <FeedbackOpenCount />}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <div className="group-data-[collapsible=icon]:hidden">
            <div className="rounded-lg border bg-muted/50 p-3 text-center">
              <p className="text-sm font-medium">
                <span className="mr-1">🚀</span>
                We're in beta
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Spotted a bug or have feedback? We'd love to hear from you.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2.5 w-full"
                onClick={() => setFeedbackOpen(true)}
              >
                Report a bug or give feedback
              </Button>
            </div>
          </div>
          <div className="group-data-[collapsible=icon]:flex hidden justify-center">
            <SidebarMenuButton
              tooltip="Give Feedback"
              onClick={() => setFeedbackOpen(true)}
              className="mx-auto"
            >
              <span className="text-base">🚀</span>
            </SidebarMenuButton>
          </div>
          <NavUser user={user} />
        </SidebarFooter>
      </Sidebar>
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </>
  );
}
