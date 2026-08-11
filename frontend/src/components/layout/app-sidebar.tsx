import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Logo } from "@/components/ui/logo";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { navItems } from "@/config/nav";
import { useAuth } from "@/hooks/use-auth";
import { NavUser } from "./nav-user";
import { BuyMeACoffeeButton } from "./buy-me-a-coffee-button";
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
  const { state } = useSidebar();
  const [showCard, setShowCard] = useState(state === "expanded");
  const [showIcon, setShowIcon] = useState(state === "collapsed");

  useEffect(() => {
    if (state === "expanded") {
      setShowIcon(false);
      const t = setTimeout(() => setShowCard(true), 200);
      return () => clearTimeout(t);
    }
    setShowCard(false);
    const t = setTimeout(() => setShowIcon(true), 200);
    return () => clearTimeout(t);
  }, [state]);

  const items = navItems.filter(
    (item) => !item.roles || (user?.role && item.roles.includes(user.role)),
  );

  return (
    <>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link to="/dashboard">
                  <Logo size={32} className="shrink-0 rounded-sm" />
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">Clastor</span>
                    <span className="truncate text-xs text-muted-foreground">
                      Tutor Management
                    </span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
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
          <div
            className={`grid transition-all duration-200 ease-out ${
              showCard
                ? "grid-rows-[1fr] opacity-100"
                : "grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="overflow-hidden">
              <div className="rounded-lg border bg-white p-3 text-center dark:bg-muted/50">
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
                <BuyMeACoffeeButton className="mt-2.5 [&_a]:mx-auto" />
              </div>
            </div>
          </div>
          <div
            className={`grid transition-all duration-200 ease-out ${
              showIcon
                ? "grid-rows-[1fr] opacity-100"
                : "grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="overflow-hidden">
              <SidebarMenuButton
                tooltip="Give Feedback"
                onClick={() => setFeedbackOpen(true)}
                className="mx-auto"
              >
                <span className="text-base">🚀</span>
              </SidebarMenuButton>
            </div>
          </div>
          <NavUser user={user} />
        </SidebarFooter>
      </Sidebar>
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </>
  );
}
