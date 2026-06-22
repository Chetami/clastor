import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, Unplug } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  useGoogleConnectionStatus,
  useConnectGoogle,
  useDisconnectGoogle,
} from "./api/use-google-connect";

function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

/**
 * Lets a tutor connect their Google account so Clastor can generate Google Meet
 * links and write to their Google Calendar. Mirrors the Stripe connection card.
 *
 * `returnTo` controls where the browser lands after the Google consent flow
 * (a same-origin path); defaults to /settings on the backend. Used by the
 * onboarding wizard to keep the user in-flow.
 */
export function GoogleConnectionCard({ returnTo }: { returnTo?: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const statusQuery = useGoogleConnectionStatus();
  const connect = useConnectGoogle(returnTo);
  const disconnect = useDisconnectGoogle();

  const googleParam = searchParams.get("google");
  const [banner, setBanner] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  // Surface the outcome of the just-completed consent flow, then refetch so the
  // freshly-persisted connection is reflected.
  useEffect(() => {
    if (!googleParam) return;
    if (googleParam === "connected") {
      setBanner({ kind: "success", message: "Google account connected." });
      statusQuery.refetch();
    } else if (googleParam === "no_refresh_token") {
      setBanner({
        kind: "error",
        message:
          "Google didn't issue a refresh token. Disconnect the app from your Google account and try again.",
      });
    } else {
      setBanner({
        kind: "error",
        message: "We couldn't connect your Google account. Please try again.",
      });
    }
    searchParams.delete("google");
    setSearchParams(searchParams, { replace: true });
  }, [googleParam]); // eslint-disable-line react-hooks/exhaustive-deps

  const status = statusQuery.data;
  const isLoading = statusQuery.isLoading;
  const connected = status?.connected;
  const queryError = statusQuery.error || connect.error || disconnect.error;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
              <GoogleGlyph className="size-5" />
            </div>
            <div>
              <CardTitle>Google</CardTitle>
              <CardDescription>
                Connect Google to generate Meet links and sync lessons to your
                calendar.
              </CardDescription>
            </div>
          </div>
          {!isLoading && status && (
            <Badge
              variant={connected ? "default" : "secondary"}
              className={connected ? "hover:bg-primary" : undefined}
            >
              {connected ? "Connected" : "Not connected"}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {banner && (
          <p
            className={`text-sm ${
              banner.kind === "success"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-destructive"
            }`}
          >
            {banner.message}
          </p>
        )}
        {queryError && (
          <p className="text-sm text-destructive">{queryError.message}</p>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : connected ? (
          <div className="flex flex-col gap-4">
            {status.googleEmail && (
              <p className="text-sm text-muted-foreground">
                Connected as{" "}
                <span className="font-medium text-foreground">
                  {status.googleEmail}
                </span>
                .
              </p>
            )}
            <div>
              <Button
                variant="outline"
                onClick={() => disconnect.mutate()}
                disabled={disconnect.isPending}
              >
                {disconnect.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Unplug className="size-4" />
                )}
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              We use a read-only Calendar scope to add Meet links to your own
              events. We never see your password and you can disconnect anytime.
            </p>
            <div>
              <Button
                onClick={() => connect.mutate()}
                disabled={connect.isPending}
              >
                {connect.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <GoogleGlyph className="mr-0.5" />
                )}
                Connect to Google
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
