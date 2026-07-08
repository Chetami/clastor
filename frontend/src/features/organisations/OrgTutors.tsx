import { Building2, Copy, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import {
  useGetOrganisation,
  useListMembers,
  useRegenerateJoinCode,
  useRemoveMember,
  useUpdateMemberRole,
} from "./api";
import { JoinOrganisationDialog } from "./join-organisation-dialog";
import type { OrgMemberRole } from "@examify-tms/interfaces";

/**
 * /tutors — the tutors (members) of the org currently active in the switcher.
 * Admins additionally see the org's join code so they can share it to add
 * tutors, and can change roles / remove members. In personal mode the page
 * prompts the user to select or join an org.
 */
export function OrgTutors() {
  const { user } = useAuth();
  const orgId = user?.currentOrgId ?? null;

  const { data: org } = useGetOrganisation(orgId ?? undefined);
  const { data: members = [], isLoading: membersLoading } = useListMembers(orgId ?? undefined);

  const updateRole = useUpdateMemberRole(orgId ?? "");
  const removeMember = useRemoveMember(orgId ?? "");
  const regenerate = useRegenerateJoinCode(orgId ?? "");

  const isAdmin =
    members.find((m) => m.userId === user?.uid)?.role === "org_admin";

  // Personal mode — no org active.
  if (!orgId) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Building2 className="size-8 text-muted-foreground" />
            <div>
              <p className="font-medium">No organisation selected</p>
              <p className="text-sm text-muted-foreground">
                Select an organisation from the switcher, or join one with a code, to see its tutors.
              </p>
            </div>
            <JoinOrganisationDialog />
          </CardContent>
        </Card>
      </div>
    );
  }

  async function handleChangeRole(userId: string, role: OrgMemberRole) {
    try {
      await updateRole.mutateAsync({ userId, role });
      toast.success("Role updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update role");
    }
  }

  async function handleRemove(userId: string, userName?: string) {
    try {
      await removeMember.mutateAsync(userId);
      toast.success(`Removed ${userName}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove member");
    }
  }

  async function handleRegenerate() {
    try {
      await regenerate.mutateAsync();
      toast.success("Join code regenerated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to regenerate");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Tutors</h2>
        <p className="text-sm text-muted-foreground">
          {org?.name ? `Members of ${org.name}.` : "Members of this organisation."}
        </p>
      </div>

      {/* Join code — the "add tutors" affordance for admins. */}
      {org?.joinCode && (
        <Card>
          <CardHeader>
            <CardTitle>Join code</CardTitle>
            <CardDescription>
              Share this code so tutors can join as members.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md border bg-muted px-3 py-2 font-mono text-lg tracking-widest">
                {org.joinCode}
              </code>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  if (org.joinCode) {
                    navigator.clipboard.writeText(org.joinCode);
                    toast.success("Copied");
                  }
                }}
              >
                <Copy className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleRegenerate}
                disabled={regenerate.isPending}
              >
                <RefreshCw className="mr-2 size-4" />
                Regenerate
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Members table. */}
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>Tutors in this organisation.</CardDescription>
        </CardHeader>
        <CardContent>
          {membersLoading ? (
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="w-[10rem]">Role</TableHead>
                  {isAdmin && <TableHead className="w-[6rem]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="size-7">
                          <AvatarImage src={m.avatarUrl ?? undefined} />
                          <AvatarFallback className="text-xs">
                            {(m.name || "?").slice(0, 1).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{m.name}</span>
                        {m.userId === user?.uid && (
                          <span className="text-xs text-muted-foreground">(you)</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{m.email}</TableCell>
                    <TableCell>
                      {isAdmin && m.userId !== user?.uid ? (
                        <Select
                          value={m.role}
                          onValueChange={(v) =>
                            handleChangeRole(m.userId, v as OrgMemberRole)
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="org_admin">Admin</SelectItem>
                            <SelectItem value="member">Member</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline">
                          {m.role === "org_admin" ? "Admin" : "Member"}
                        </Badge>
                      )}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          disabled={removeMember.isPending}
                          onClick={() => handleRemove(m.userId, m.name)}
                        >
                          Remove
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
