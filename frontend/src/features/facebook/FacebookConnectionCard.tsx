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
  useFacebookConnectionStatus,
  useConnectFacebook,
  useDisconnectFacebook,
  useFacebookPages,
  useSelectFacebookPage,
} from "./api/use-facebook-connect";

function FacebookGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      fill="currentColor"
    >
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

/**
 * Lets a tutor connect their Facebook account and select a Page so Clastor can
 * publish posts to it. Mirrors the Google connection card.
 *
 * The `fb` query param surfaces the outcome of the just-completed consent
 * flow: `connected`, `select_pages` (multi-Page picker), `no_pages`, or
 * `error`.
 */
export function FacebookConnectionCard({ returnTo }: { returnTo?: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const statusQuery = useFacebookConnectionStatus();
  const connect = useConnectFacebook(returnTo);
  const disconnect = useDisconnectFacebook();
  const pagesQuery = useFacebookPages();
  const selectPage = useSelectFacebookPage();

  const fbParam = searchParams.get("fb");
  const [banner, setBanner] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  // Surface the outcome of the just-completed consent flow, then refetch so the
  // freshly-persisted connection (or pending Pages) is reflected.
  useEffect(() => {
    if (!fbParam) return;
    if (fbParam === "connected") {
      setBanner({ kind: "success", message: "Facebook Page connected." });
      statusQuery.refetch();
    } else if (fbParam === "select_pages") {
      setBanner({
        kind: "error",
        message: "Pick which Facebook Page you'd like to post to.",
      });
      pagesQuery.refetch();
    } else if (fbParam === "no_pages") {
      setBanner({
        kind: "error",
        message: "We couldn't find any Facebook Pages you manage.",
      });
    } else {
      setBanner({
        kind: "error",
        message: "We couldn't connect your Facebook account. Please try again.",
      });
    }
    searchParams.delete("fb");
    setSearchParams(searchParams, { replace: true });
  }, [fbParam]); // eslint-disable-line react-hooks/exhaustive-deps

  const status = statusQuery.data;
  const isLoading = statusQuery.isLoading;
  const connected = status?.connected;
  const pendingPages = pagesQuery.data;
  const needsPageSelection = !connected && (pendingPages?.length ?? 0) > 0;
  const queryError = statusQuery.error || connect.error || disconnect.error;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#1877F2] text-white">
              <FacebookGlyph className="size-5" />
            </div>
            <div>
              <CardTitle>Facebook</CardTitle>
              <CardDescription>
                Connect a Facebook Page so you can publish posts directly from
                Clastor.
              </CardDescription>
            </div>
          </div>
          {!isLoading && status && (
            <Badge
              variant={connected ? "default" : "secondary"}
              className={`whitespace-nowrap ${connected ? "hover:bg-primary" : "hover:bg-secondary"}`}
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
            {status.pageName && (
              <p className="text-sm text-muted-foreground">
                Posting to{" "}
                <span className="font-medium text-foreground">
                  {status.pageName}
                </span>
                .
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
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
        ) : needsPageSelection ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Choose a Page to post to:
            </p>
            <div className="flex flex-col gap-2">
              {pendingPages!.map((page) => (
                <Button
                  key={page.id}
                  variant="outline"
                  className="justify-start"
                  onClick={() => selectPage.mutate(page.id)}
                  disabled={selectPage.isPending}
                >
                  {selectPage.isPending && selectPage.variables === page.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  {page.name}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              We post to a Facebook Page you manage (Facebook doesn't allow apps
              to post to personal profiles). You can disconnect anytime.
            </p>
            <div>
              <Button
                onClick={() => connect.mutate()}
                disabled={connect.isPending}
              >
                {connect.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FacebookGlyph className="mr-0.5" />
                )}
                Connect to Facebook
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
