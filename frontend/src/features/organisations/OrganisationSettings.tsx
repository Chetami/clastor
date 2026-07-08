import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Copy, Loader2, RefreshCw, Shield, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
  useDeleteOrganisation,
  useGetOrganisation,
  useListMembers,
  useRegenerateJoinCode,
  useRemoveMember,
  useSwitchActiveOrg,
  useUpdateMemberRole,
  useUpdateOrganisation,
} from "./api";
import type { OrgMemberRole } from "@examify-tms/interfaces";

/** /organisations/:orgId — manage an organisation (admin-only actions gated). */
export function OrganisationSettings() {
  const { orgId = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: org, isLoading: orgLoading } = useGetOrganisation(orgId);
  const { data: members = [], isLoading: membersLoading } = useListMembers(orgId);

  const updateOrg = useUpdateOrganisation(orgId);
  const regenerate = useRegenerateJoinCode(orgId);
  const updateRole = useUpdateMemberRole(orgId);
  const removeMember = useRemoveMember(orgId);
  const deleteOrg = useDeleteOrganisation();
  const switchOrg = useSwitchActiveOrg();

  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isAdmin =
    members.find((m) => m.userId === user?.uid)?.role === "org_admin";

  // Seed the editable fields once the org has loaded.
  useEffect(() => {
    if (org) {
      setName(org.name);
      setLogoUrl(org.logoUrl ?? "");
    }
  }, [org]);

  async function handleSaveDetails(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updateOrg.mutateAsync({
        name: name.trim() || undefined,
        logoUrl: logoUrl.trim() || null,
      });
      toast.success("Organisation updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
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
      // Removing yourself kicks you out of the org view.
      if (userId === user?.uid) navigate("/organisations");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove member");
    }
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      const wasActive = user?.currentOrgId === orgId;
      await deleteOrg.mutateAsync(orgId);
      if (wasActive) await switchOrg.mutateAsync(null);
      toast.success("Organisation archived");
      navigate("/organisations");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
      setConfirmDelete(false);
    }
  }

  if (orgLoading) {
    return <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />;
  }
  if (!org) {
    return <p className="text-sm text-muted-foreground">Organisation not found.</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{org.name}</h2>
          <p className="text-sm text-muted-foreground">Organisation settings</p>
        </div>
        {isAdmin && (
          <Badge variant="secondary" className="gap-1">
            <Shield className="size-3" /> Admin
          </Badge>
        )}
      </div>

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>Name and logo URL for this organisation.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveDetails} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                placeholder={org.name}
                onChange={(e) => setName(e.target.value)}
                disabled={!isAdmin || updateOrg.isPending}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input
                id="logoUrl"
                value={logoUrl}
                placeholder={org.logoUrl ?? "https://…"}
                onChange={(e) => setLogoUrl(e.target.value)}
                disabled={!isAdmin || updateOrg.isPending}
              />
            </div>
            {isAdmin && (
              <Button type="submit" disabled={updateOrg.isPending}>
                {updateOrg.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                Save changes
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Join code (admin only) */}
      {isAdmin && (
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

      {/* Members */}
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

      {/* Danger zone (admin only) */}
      {isAdmin && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Danger zone</CardTitle>
            <CardDescription>
              Archive this organisation. Members lose access. This can only be
              undone by a system administrator.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant={confirmDelete ? "destructive" : "outline"}
              disabled={deleteOrg.isPending}
              onClick={handleDelete}
            >
              <Trash2 className="mr-2 size-4" />
              {confirmDelete ? "Click again to confirm" : "Archive organisation"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
