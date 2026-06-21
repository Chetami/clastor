import { useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, CreditCard, ExternalLink, Loader2 } from "lucide-react";

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
  useStripeConnectStatus,
  useConnectStripe,
  useOpenStripeDashboard,
} from "./api";

export default function StripePaymentsSettings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const statusQuery = useStripeConnectStatus();
  const connect = useConnectStripe();
  const dashboard = useOpenStripeDashboard();

  const stripeParam = searchParams.get("stripe");

  // After returning from Stripe onboarding, clear the param and refetch so the
  // freshly-submitted status (which may lag a moment) is reflected.
  useEffect(() => {
    if (stripeParam === "return") {
      statusQuery.refetch();
      searchParams.delete("stripe");
      setSearchParams(searchParams, { replace: true });
    }
  }, [stripeParam]); // eslint-disable-line react-hooks/exhaustive-deps

  // If Stripe bounced us back because the onboarding link expired, mint a new
  // one and redirect again.
  useEffect(() => {
    if (stripeParam === "refresh") {
      connect.mutate();
      searchParams.delete("stripe");
      setSearchParams(searchParams, { replace: true });
    }
  }, [stripeParam]); // eslint-disable-line react-hooks/exhaustive-deps

  const status = statusQuery.data;
  const isLoading = statusQuery.isLoading;
  const error = statusQuery.error || connect.error || dashboard.error;

  const connected = status?.connected;
  const readyForPayments = status?.chargesEnabled;
  const onboardingIncomplete = connected && !readyForPayments;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/settings">
            <ArrowLeft className="size-4" />
            Back to settings
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                <CreditCard className="size-5" />
              </div>
              <div>
                <CardTitle>Online payments</CardTitle>
                <CardDescription>
                  Get paid by card. Funds go straight to your bank via Stripe.
                </CardDescription>
              </div>
            </div>
            {!isLoading && status && (
              <Badge variant={readyForPayments ? "default" : "secondary"}>
                {readyForPayments
                  ? "Ready"
                  : connected
                    ? "Incomplete"
                    : "Not connected"}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {error && <p className="text-sm text-destructive">{error.message}</p>}

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !connected ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Connect a Stripe account to add a “Pay online” button to your
                invoices. You'll be taken to Stripe to enter your bank details —
                we never see or hold your money.
              </p>
              <div>
                <Button
                  onClick={() => connect.mutate()}
                  disabled={connect.isPending}
                >
                  {connect.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CreditCard className="size-4" />
                  )}
                  Connect to Stripe
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="grid gap-2 text-sm">
                <StatusRow
                  label="Onboarding complete"
                  ok={status.detailsSubmitted}
                />
                <StatusRow
                  label="Can accept payments"
                  ok={status.chargesEnabled}
                />
                <StatusRow
                  label="Payouts to bank enabled"
                  ok={status.payoutsEnabled}
                />
              </div>

              {onboardingIncomplete && (
                <p className="text-sm text-muted-foreground">
                  Your account still needs a few details before it can accept
                  payments. Finish setup in Stripe.
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  variant={onboardingIncomplete ? "default" : "outline"}
                  onClick={() => connect.mutate()}
                  disabled={connect.isPending}
                >
                  {connect.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CreditCard className="size-4" />
                  )}
                  {onboardingIncomplete ? "Finish setup" : "Update details"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => dashboard.mutate()}
                  disabled={dashboard.isPending}
                >
                  {dashboard.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ExternalLink className="size-4" />
                  )}
                  Manage payouts in Stripe
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Funds from each payment are deposited directly into your bank
                account by Stripe. Clastor never holds your money and takes no
                fee.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <Badge variant={ok ? "default" : "secondary"}>
        {ok ? "Yes" : "No"}
      </Badge>
    </div>
  );
}
