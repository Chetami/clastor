import { GoogleConnectionCard } from "@/features/settings/GoogleConnectionCard";

/**
 * Google connect step. Reuses the Settings connection card, but tells the
 * consent flow to send the browser back here (returnTo="/onboarding") so the
 * user lands back in the wizard after granting access.
 */
export function GoogleConnectStep() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 px-1">
        <h2 className="text-lg font-semibold tracking-tight">
          Connect your calendar
        </h2>
        <p className="text-sm text-muted-foreground">
          Optional, but recommended — connecting Google lets Clastor generate
          Meet links for your lessons and add them to your calendar.
        </p>
      </div>
      <GoogleConnectionCard returnTo="/onboarding" />
    </div>
  );
}
