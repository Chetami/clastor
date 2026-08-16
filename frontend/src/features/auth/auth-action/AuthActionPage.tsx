import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  applyActionCode,
  confirmPasswordReset,
  verifyPasswordResetCode,
} from "firebase/auth";
import { CircleAlert, CircleCheck, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PasswordInput } from "@/components/ui/password-input";
import { getFirebaseAuth } from "@/config/firebase";
import { useAuthStore } from "@/store/auth-store";
import { BrandMark } from "@/features/auth/BrandMark";

/**
 * Custom Firebase email-action handler for /auth/action. Firebase links
 * (verification, password reset) land here with mode + oobCode query params;
 * this page applies the code client-side so the whole flow stays on-brand
 * instead of bouncing through Firebase's generic hosted page.
 *
 * Configure Firebase Console → Authentication → Templates → "Custom action
 * URL" to point at <frontend>/auth/action.
 */

type Phase =
  | { kind: "working" }
  | { kind: "done"; title: string; message: string; continueTo: string }
  | { kind: "reset-form"; email: string }
  | {
      kind: "error";
      title: string;
      message: string;
      showForgotLink: boolean;
    };

/** Only allow relative continue targets (no open redirects). */
function safeContinueUrl(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/login";
}

function friendlyError(error: unknown): string {
  const code = (error as { code?: string }).code ?? "";
  switch (code) {
    case "auth/expired-action-code":
      return "This link has expired. Request a new one and try again.";
    case "auth/invalid-action-code":
      return "This link has already been used or is invalid. Request a new one and try again.";
    case "auth/weak-password":
      return "That password is too weak — use at least 6 characters.";
    case "auth/user-disabled":
      return "This account has been disabled. Contact support.";
    default:
      return "Something went wrong. Please request a new link and try again.";
  }
}

export default function AuthActionPage() {
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const hasSession = useAuthStore((s) => !!s.token);

  const mode = params.get("mode") ?? "";
  const oobCode = params.get("oobCode") ?? "";
  const continueTo = safeContinueUrl(params.get("continueUrl"));

  const [phase, setPhase] = useState<Phase>({ kind: "working" });
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const supported = useMemo(
    () => ["verifyEmail", "resetPassword", "recoverEmail"].includes(mode),
    [mode],
  );

  useEffect(() => {
    if (!supported || !oobCode) return;

    const auth = getFirebaseAuth();
    let cancelled = false;

    async function run() {
      try {
        if (mode === "verifyEmail") {
          await applyActionCode(auth, oobCode);
          if (cancelled) return;
          // If they're signed in on this device, refresh the session's
          // emailVerified flag so the dashboard banner disappears.
          if (hasSession) {
            void queryClient.invalidateQueries({
              queryKey: ["auth", "verify"],
            });
          }
          setPhase({
            kind: "done",
            title: "Email verified",
            message:
              "Thanks! Your email is confirmed — everything in Clastor is now unlocked.",
            continueTo,
          });
        } else if (mode === "recoverEmail") {
          await applyActionCode(auth, oobCode);
          if (cancelled) return;
          setPhase({
            kind: "done",
            title: "Email restored",
            message:
              "Your account's email address has been reverted. Sign in with the original address.",
            continueTo: "/login",
          });
        } else {
          // resetPassword: validate the code first; the form submits after.
          const email = await verifyPasswordResetCode(auth, oobCode);
          if (cancelled) return;
          setPhase({ kind: "reset-form", email });
        }
      } catch (error) {
        if (cancelled) return;
        setPhase({
          kind: "error",
          title: "Link problem",
          message: friendlyError(error),
          showForgotLink: mode === "resetPassword",
        });
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [mode, oobCode, continueTo, supported, hasSession, queryClient]);

  async function handleResetSubmit(e: FormEvent) {
    e.preventDefault();
    setResetError(null);

    if (newPassword.length < 6) {
      setResetError("Passwords must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError("Passwords don't match.");
      return;
    }

    setResetting(true);
    try {
      await confirmPasswordReset(getFirebaseAuth(), oobCode, newPassword);
      setPhase({
        kind: "done",
        title: "Password updated",
        message: "Your new password is ready — sign in with it below.",
        continueTo: "/login",
      });
    } catch (error) {
      setResetError(friendlyError(error));
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-b from-muted/50 to-background p-4">
      <div className="absolute top-4 left-4">
        <BrandMark size={40} />
      </div>
      <Card className="w-full max-w-md shadow-lg">
        {phase.kind === "working" && supported && oobCode && (
          <>
            <CardHeader className="items-center text-center">
              <CardTitle className="text-2xl">One moment</CardTitle>
              <CardDescription>Checking your link…</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center pb-8">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </CardContent>
          </>
        )}

        {phase.kind === "done" && (
          <>
            <CardHeader className="items-center text-center">
              <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                <CircleCheck className="size-6" />
              </div>
              <CardTitle className="text-2xl">{phase.title}</CardTitle>
              <CardDescription>{phase.message}</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center pb-8">
              <Button asChild>
                <Link to={phase.continueTo}>Continue</Link>
              </Button>
            </CardContent>
          </>
        )}

        {phase.kind === "error" && (
          <>
            <CardHeader className="items-center text-center">
              <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <CircleAlert className="size-6" />
              </div>
              <CardTitle className="text-2xl">{phase.title}</CardTitle>
              <CardDescription>{phase.message}</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center pb-8">
              {phase.showForgotLink ? (
                <Button asChild>
                  <Link to="/forgot-password">Request a new link</Link>
                </Button>
              ) : (
                <Button variant="outline" asChild>
                  <Link to="/login">Back to sign in</Link>
                </Button>
              )}
            </CardContent>
          </>
        )}

        {phase.kind === "reset-form" && (
          <>
            <CardHeader className="items-center text-center">
              <CardTitle className="text-2xl">Choose a new password</CardTitle>
              <CardDescription>
                Setting a new password for{" "}
                <span className="font-medium text-foreground">
                  {phase.email}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleResetSubmit} className="space-y-4">
                {resetError && (
                  <Alert variant="destructive">
                    <AlertDescription>{resetError}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="new-password">New password</Label>
                  <PasswordInput
                    id="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">
                    Confirm new password
                  </Label>
                  <PasswordInput
                    id="confirm-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>

                <Button type="submit" disabled={resetting} className="w-full">
                  {resetting ? "Updating..." : "Update password"}
                </Button>
              </form>
            </CardContent>
          </>
        )}

        {!supported || !oobCode ? (
          <>
            <CardHeader className="items-center text-center">
              <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <CircleAlert className="size-6" />
              </div>
              <CardTitle className="text-2xl">Invalid link</CardTitle>
              <CardDescription>
                This link is missing required information. Use the app to
                request a new one.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center pb-8">
              <Button variant="outline" asChild>
                <Link to="/login">Back to sign in</Link>
              </Button>
            </CardContent>
          </>
        ) : null}
      </Card>
    </div>
  );
}
