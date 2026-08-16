import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MailCheck, MailWarning } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth-store";
import { resendVerificationRequest } from "@/features/auth/api";

/**
 * Persistent banner shown while the signed-in user's email is unverified.
 * Unverified users can use the app, but actions that reach other people
 * (emails to students, invoices, calendar writes) are disabled — see
 * EmailGuard and the backend's requireVerifiedEmail middleware.
 */
export function VerifyEmailBanner() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [resent, setResent] = useState(false);

  const resend = useMutation({
    mutationFn: resendVerificationRequest,
    onSuccess: (data) => {
      setResent(true);
      toast.success(data.message);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Couldn't send the email",
      );
    },
  });

  // emailVerified is undefined for sessions hydrated by older responses —
  // treat unknown as verified so we never nag a legitimate user.
  if (!user || user.emailVerified !== false) {
    return null;
  }

  async function refreshStatus() {
    await queryClient.invalidateQueries({ queryKey: ["auth", "verify"] });
  }

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between lg:mb-6">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600">
          {resent ? (
            <MailCheck className="size-4" />
          ) : (
            <MailWarning className="size-4" />
          )}
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-medium">
            {resent ? "Verification email sent" : "Verify your email"}
          </p>
          <p className="text-xs text-muted-foreground">
            {resent
              ? `Check ${user.email} and follow the link, then refresh below.`
              : "Sending emails to students and invoices is unlocked once your email is verified."}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refreshStatus()}
        >
          I've verified — refresh
        </Button>
        <Button
          size="sm"
          disabled={resend.isPending}
          onClick={() => resend.mutate()}
        >
          {resend.isPending ? "Sending…" : resent ? "Resend again" : "Resend email"}
        </Button>
      </div>
    </div>
  );
}
