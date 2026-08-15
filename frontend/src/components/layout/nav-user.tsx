import {
  LogOut,
  User as UserIcon,
  Settings as SettingsIcon,
  ChevronsUpDown,
  Compass,
  Palette,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { AppearanceDialog } from "@/components/layout/appearance-dialog";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useLogout } from "@/features/auth/api";
import { useProductTour } from "@/features/tour/use-product-tour";
import type { UserInfo } from "@examify-tms/interfaces";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function NavUser({ user }: { user: UserInfo | null }) {
  const { isMobile, state } = useSidebar();
  const logout = useLogout();
  const { start: startTour } = useProductTour();
  const navigate = useNavigate();
  const [appearanceOpen, setAppearanceOpen] = useState(false);

  if (!user) {
    return null;
  }

  const displayName = user.name ?? user.email;
  const initials = user.name
    ? user.name.slice(0, 2).toUpperCase()
    : (user.email?.slice(0, 2).toUpperCase() ?? "?");
  
  const isCollapsed = state === "collapsed" && !isMobile;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {isCollapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="h-auto! w-auto! rounded-full p-1.5 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <Avatar className="size-8 shrink-0 rounded-full">
                      {user.avatarUrl && (
                        <AvatarImage src={user.avatarUrl} alt={displayName} />
                      )}
                      <AvatarFallback className="rounded-full">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </SidebarMenuButton>
                </TooltipTrigger>
                <TooltipContent side="right" align="start">
                  <p className="font-semibold">{displayName}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {user.role.replace("_", " ")}
                  </p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <Avatar className="size-8 shrink-0 rounded-full">
                  {user.avatarUrl && (
                    <AvatarImage src={user.avatarUrl} alt={displayName} />
                  )}
                  <AvatarFallback className="rounded-full">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{displayName}</span>
                  <span className="truncate text-xs capitalize text-muted-foreground">
                    {user.role.replace("_", " ")}
                  </span>
                </div>
                <ChevronsUpDown className="ml-auto size-4" />
              </SidebarMenuButton>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="size-8 rounded-full">
                  {user.avatarUrl && (
                    <AvatarImage src={user.avatarUrl} alt={displayName} />
                  )}
                  <AvatarFallback className="rounded-full">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{displayName}</span>
                  <span className="truncate text-xs capitalize text-muted-foreground">
                    {user.role.replace("_", " ")}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={() => navigate("/account")}>
                <UserIcon />
                Account
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate("/settings")}>
                <SettingsIcon />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setAppearanceOpen(true)}>
                <Palette />
                Appearance
              </DropdownMenuItem>
              {user.role !== "system_admin" && (
                <DropdownMenuItem onSelect={() => startTour()}>
                  <Compass />
                  Take a tour
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {/* onSelect (not onClick) so keyboard activation works too. */}
            <DropdownMenuItem
              onSelect={() => logout.mutate()}
              disabled={logout.isPending}
            >
              <LogOut />
              {logout.isPending ? "Logging out..." : "Log out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
      <AppearanceDialog
        open={appearanceOpen}
        onOpenChange={setAppearanceOpen}
      />
    </SidebarMenu>
  );
}
