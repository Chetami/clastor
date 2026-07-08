import { useState } from "react";
import { Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useJoinOrganisation } from "./api";

/** Join an organisation with a shareable join code. Adds membership only. */
export function JoinOrganisationDialog({
  children,
  open: openProp,
  onOpenChange,
}: {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [code, setCode] = useState("");
  const join = useJoinOrganisation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    try {
      const { organisation, created } = await join.mutateAsync({
        joinCode: trimmed.toUpperCase(),
      });
      toast.success(
        created
          ? `Joined “${organisation.name}”`
          : `You're already a member of “${organisation.name}”`,
      );
      setOpen(false);
      setCode("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to join organisation");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? (
          <Button size="sm" variant="outline" className="gap-2">
            <LogIn className="size-4" /> Join with code
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Join an organisation</DialogTitle>
            <DialogDescription>
              Enter the join code an organisation admin shared with you. You'll
              be added as a member.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="join-code">Join code</Label>
            <Input
              id="join-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="ABC12345"
              className="font-mono uppercase"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={join.isPending || !code.trim()}>
              {join.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Join
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
