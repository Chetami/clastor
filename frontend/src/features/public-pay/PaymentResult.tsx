import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaymentResultProps {
  /** success = payment completed; cancel = user abandoned checkout. */
  variant: "success" | "cancel";
}

/**
 * Minimal public landing page Stripe redirects to after checkout. These pages
 * are reached outside any authenticated session (the payer is not a user), so
 * they render standalone — no dashboard chrome, no auth guard.
 */
export function PaymentResult({ variant }: PaymentResultProps) {
  const isSuccess = variant === "success";

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
        <div
          className={`flex size-14 items-center justify-center rounded-full ${
            isSuccess ? "bg-green-100 text-green-600" : "bg-muted text-muted-foreground"
          }`}
        >
          {isSuccess ? (
            <CheckCircle2 className="size-8" />
          ) : (
            <XCircle className="size-8" />
          )}
        </div>

        <div className="space-y-1">
          <h1 className="text-xl font-semibold">
            {isSuccess ? "Payment received" : "Payment cancelled"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isSuccess
              ? "Thank you! Your payment has been processed. You can close this window."
              : "Your payment was not completed. You can try again from the payment link in your email."}
          </p>
        </div>

        {isSuccess && (
          <Button variant="outline" onClick={() => window.close()}>
            Close
          </Button>
        )}
      </div>
    </div>
  );
}
