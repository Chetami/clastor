import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AvatarUpload } from "@/components/account/AvatarUpload";
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
import { useAuthStore } from "@/store/auth-store";
import { updateUserNameRequest } from "@/features/settings/api/requests";

export default function Account() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [name, setName] = useState(user?.name ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const trimmed = name.trim();
  const isUnchanged = trimmed === (user?.name ?? "");
  const canSave = trimmed.length > 0 && !isUnchanged && !isSaving;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;

    setIsSaving(true);
    try {
      const updated = await updateUserNameRequest(trimmed);
      setUser(updated);
      setName(updated.name ?? "");
      toast.success("Name updated");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update name",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your profile picture.</CardDescription>
        </CardHeader>
        <CardContent>
          <AvatarUpload />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>
            The name shown across your account and to your students.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                maxLength={100}
                disabled={isSaving}
                className="sm:w-80"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={user?.email ?? ""}
                readOnly
                aria-readonly
                className="sm:w-80 cursor-default focus-visible:ring-0"
              />
              <p className="text-xs text-muted-foreground">
                Email is tied to your sign-in and can't be changed here.
              </p>
            </div>

            <div>
              <Button type="submit" disabled={!canSave}>
                {isSaving && <Loader2 className="size-4 animate-spin" />}
                Save changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
