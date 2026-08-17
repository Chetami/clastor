import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CircleAlert, Loader2 } from "lucide-react";
import { exchangeGoogleLoginCode } from "@examify-tms/shared";
import { useAuthStore } from "@/store/auth-store";
import { queryClient } from "@/lib/query-client";
import { track } from "@/lib/analytics";
import { clearSurvey } from "@/features/auth/signup/survey-storage";
import { BrandMark } from "@/features/auth/BrandMark";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Landing route for the merged Google login flow. The backend OAuth callback
 * redirects here with a single-use `code` (or an `error` reason); this page
 * swaps the code for the app's JWT pair over the back channel — tokens never
 * appear in the URL — then establishes the session and routes the user on.
 */

const ERROR_MESSAGES: Record<string, string> = {
  denied: "Google sign-in was cancelled. You can try again any time.",
  rate_limited:
    "Too many sign-in attempts. Please wait a few minutes and try again.",
  email_not_verified:
    "Your Google account's email address isn't verified. Verify it with Google, then try again.",
  server_error:
    "We couldn't sign you in with Google. Please try again.",
};

/**
 * Defense-in-depth mirror of the backend's return-path check: only same-origin
 * absolute paths (never "//") may be navigated to after login.
 */
function safeReturnTo(raw: string | null): string | null {
  if (!raw?.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

export default function GoogleLoginCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [error, setError] = useState<string | null>(() => {
    const reason = searchParams.get("error");
    return reason
      ? (ERROR_MESSAGES[reason] ?? ERROR_MESSAGES.server_error)
      : null;
  });

  // The one-time code is single-use: guard against React StrictMode's
  // double-invoked effects in dev (and any re-mount) burning it twice. The
  // ref alone is the guard — there is deliberately NO "cancelled" cleanup:
  // StrictMode's simulated unmount would set it after the exchange started,
  // and the remount is skipped by this ref, so gating completion on it would
  // strand the page on the spinner forever.
  const exchanged = useRef(false);

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code || exchanged.current) return;
    exchanged.current = true;

    (async () => {
      try {
        const data = await exchangeGoogleLoginCode(code);

        queryClient.clear();
        setAuth(data.user, data.jwtToken, data.refreshToken);

        if (data.isNewUser) {
          track("signup_success", { method: "google" });
          clearSurvey();
        }

        const returnTo = safeReturnTo(searchParams.get("returnTo"));
        navigate(
          returnTo ?? (data.user.onboardingComplete ? "/dashboard" : "/onboarding"),
          { replace: true },
        );
      } catch {
        setError(
          "Your sign-in code expired or was already used. Please sign in again.",
        );
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-b from-muted/50 to-background p-4">
      <div className="absolute top-4 left-4">
        <BrandMark size={40} />
      </div>
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="items-center text-center">
          <CardTitle className="text-2xl">
            {error ? "Sign-in incomplete" : "Signing you in…"}
          </CardTitle>
          <CardDescription>
            {error
              ? "Something went wrong completing Google sign-in."
              : "Finishing up your Google sign-in."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {error ? (
            <>
              <div className="flex items-start gap-2.5 text-left">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
              <Button asChild className="w-full">
                <Link to="/login" replace>
                  Back to sign in
                </Link>
              </Button>
            </>
          ) : (
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
