import { Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useAuthStore } from "@/store/auth-store";
import { useUpdateEmailReviewSettings } from "./api/use-update-email-review-settings";

/**
 * Toggle for the global "review emails before sending" preference. When off,
 * outbound emails (invoice sends, etc.) are sent immediately in the background
 * with no compose/preview step. Individual surfaces can still be registered as
 * background-send exceptions regardless of this setting.
 */
export function EmailReviewCard() {
  const user = useAuthStore((s) => s.user);
  const updateSettings = useUpdateEmailReviewSettings();

  // Null/undefined means review is enabled (the default). Only an explicit
  // `reviewEnabled: false` disables review.
  const reviewEnabled = user?.emailReviewSettings?.reviewEnabled !== false;

  function handleToggle(checked: boolean) {
    // checked === true  → review ON  → store null (default)
    // checked === false → review OFF → store { reviewEnabled: false }
    updateSettings.mutate(checked ? null : { reviewEnabled: false }, {
      onError: (err) =>
        toast.error(
          err instanceof Error
            ? err.message
            : "Couldn't save email review preference.",
        ),
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MailCheck className="size-4" />
          Review emails before sending
        </CardTitle>
        <CardDescription>
          When on, you'll review and edit each email before it's sent. Turn it
          off to send emails immediately in the background — useful once you're
          happy with your default message. Some quick actions (like marking
          attendance from Things to do) always send in the background.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <label className="flex cursor-pointer items-center justify-between gap-4">
          <span className="text-sm font-medium">
            {reviewEnabled ? "Review before sending" : "Send immediately"}
          </span>
          <div className="flex items-center gap-2">
            {updateSettings.isPending && (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            )}
            <Switch
              checked={reviewEnabled}
              onCheckedChange={handleToggle}
              disabled={updateSettings.isPending}
            />
          </div>
        </label>
      </CardContent>
    </Card>
  );
}
