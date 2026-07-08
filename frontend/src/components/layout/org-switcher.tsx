import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check,
  ChevronsUpDown,
  User as UserIcon,
  LogIn,
  Settings,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
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
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import {
  useListOrganisations,
  useSwitchActiveOrg,
} from "@/features/organisations/api";
import { JoinOrganisationDialog } from "@/features/organisations/join-organisation-dialog";

/** Notion-style workspace switcher, living at the top of the sidebar. The
 *  trigger reflects the active scope (an organisation's logo+name, or the
 *  user's avatar + "Personal"); opening it lists every org the user belongs
 *  to plus create/join/manage actions. Switching re-issues the access JWT
 *  (currentOrgId baked in) via PATCH /users/me. */
export function OrgSwitcher() {
  const { isMobile } = useSidebar();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: organisations = [], isLoading } = useListOrganisations();
  const switchOrg = useSwitchActiveOrg();

  const [joinOpen, setJoinOpen] = useState(false);

  const activeOrgId = user?.currentOrgId ?? null;
  const activeOrg = organisations.find((o) => o.id === activeOrgId) ?? null;
  const activeLabel = activeOrg ? activeOrg.name : "Personal";
  const activeSubLabel = activeOrg ? "Organisation" : "Your workspace";

  function handleSwitch(orgId: string | null) {
    if (orgId === activeOrgId) return;
    switchOrg.mutate(orgId);
  }

  const busy = switchOrg.isPending;
  const userInitials = user?.name
    ? user.name.slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? "?";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              disabled={busy}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              {activeOrg ? (
                <Avatar className="size-8 shrink-0 rounded-lg">
                  {activeOrg.logoUrl && (
                    <AvatarImage
                      src={activeOrg.logoUrl}
                      alt={activeOrg.name}
                    />
                  )}
                  <AvatarFallback className="rounded-lg bg-primary text-primary-foreground">
                    {activeOrg.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <Avatar className="size-8 shrink-0 rounded-lg">
                  {user?.avatarUrl && (
                    <AvatarImage src={user.avatarUrl} alt={activeLabel} />
                  )}
                  <AvatarFallback className="rounded-lg bg-muted">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{activeLabel}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {activeSubLabel}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-60 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="start"
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Workspaces
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuItem
              onSelect={() => handleSwitch(null)}
              className="justify-between gap-2"
            >
              <span className="flex min-w-0 items-center gap-2">
                <UserIcon className="size-4 shrink-0" />
                <span className="truncate">Personal</span>
              </span>
              {activeOrgId === null && <Check className="size-4 shrink-0" />}
            </DropdownMenuItem>

            {isLoading ? (
              <div className="space-y-2 p-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              organisations.map((org) => (
                <DropdownMenuItem
                  key={org.id}
                  onSelect={() => handleSwitch(org.id)}
                  className="justify-between gap-2"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Avatar className="size-4 shrink-0 rounded-sm">
                      {org.logoUrl && (
                        <AvatarImage src={org.logoUrl} alt={org.name} />
                      )}
                      <AvatarFallback className="rounded-sm bg-primary text-[0.5rem] text-primary-foreground">
                        {org.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">{org.name}</span>
                  </span>
                  {org.id === activeOrgId && (
                    <Check className="size-4 shrink-0" />
                  )}
                </DropdownMenuItem>
              ))
            )}

            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setJoinOpen(true)}>
              <LogIn />
              Join with code
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate("/organisations")}>
              <Settings />
              Manage organisations
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>

      <JoinOrganisationDialog open={joinOpen} onOpenChange={setJoinOpen} />
    </SidebarMenu>
  );
}
