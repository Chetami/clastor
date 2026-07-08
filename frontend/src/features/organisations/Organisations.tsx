import { Link } from "react-router-dom";
import { Building2, ChevronRight, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useListOrganisations, useSwitchActiveOrg } from "./api";
import { CreateOrganisationDialog } from "./create-organisation-dialog";
import { JoinOrganisationDialog } from "./join-organisation-dialog";

/** /organisations — lists orgs the user belongs to, with create + join actions. */
export function Organisations() {
  const { user } = useAuth();
  const { data: organisations = [], isLoading } = useListOrganisations();
  const switchOrg = useSwitchActiveOrg();
  const activeOrgId = user?.currentOrgId ?? null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Organisations</h2>
          <p className="text-sm text-muted-foreground">
            Companies you belong to. Switch scope from the top bar anytime.
          </p>
        </div>
        <div className="flex gap-2">
          <JoinOrganisationDialog />
          <CreateOrganisationDialog />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : organisations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Building2 className="size-8 text-muted-foreground" />
            <div>
              <p className="font-medium">No organisations yet</p>
              <p className="text-sm text-muted-foreground">
                Create one, or join an existing organisation with a code.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {organisations.map((org) => {
            const isActive = org.id === activeOrgId;
            return (
              <Card key={org.id}>
                <CardContent className="flex items-center gap-3 py-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Building2 className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{org.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {isActive ? "Active scope" : "Member"}
                    </p>
                  </div>
                  {!isActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={switchOrg.isPending}
                      onClick={() => switchOrg.mutate(org.id)}
                    >
                      Switch to
                    </Button>
                  )}
                  <Button asChild size="sm" variant="ghost" className="gap-1">
                    <Link to={`/organisations/${org.id}`}>
                      <Settings className="size-4" />
                      <span className="hidden sm:inline">Manage</span>
                      <ChevronRight className="size-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
