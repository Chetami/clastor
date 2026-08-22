import { Check, Star, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useListMyReviews } from "./api/use-list-my-reviews";
import { useModerateReview } from "./api/use-moderate-review";
import { RatingStars } from "@/features/public-tutor/templates/blocks/RatingStars";
import type { TutorReview } from "@examify-tms/interfaces";

function StatusPill({ status }: { status: TutorReview["status"] }) {
  if (status === "approved") {
    return (
      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">
        Approved
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        Rejected
      </span>
    );
  }
  return (
    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600">
      Pending
    </span>
  );
}

/**
 * Moderation surface for reviews left on the tutor's public page. Reviews
 * are only visible publicly once approved — pending items surface first.
 */
export function ReviewsModerationCard() {
  const { data, isLoading } = useListMyReviews();
  const moderate = useModerateReview();

  const reviews = data?.items ?? [];
  const pending = reviews.filter((r) => r.status === "pending");

  return (
    <div className="space-y-3">
      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      )}

      {!isLoading && reviews.length === 0 && (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No reviews yet. They'll appear here after students or parents leave
          one on your public page.
        </p>
      )}

      {[...pending, ...reviews.filter((r) => r.status !== "pending")].map(
        (review) => (
          <div key={review.id} className="rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{review.authorName}</span>
                <RatingStars ratingAvg={review.rating} />
              </div>
              <StatusPill status={review.status} />
            </div>
            {review.comment && (
              <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                {review.comment}
              </p>
            )}
            {review.status === "pending" && (
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  disabled={moderate.isPending}
                  onClick={() =>
                    moderate.mutate({ reviewId: review.id, action: "approve" })
                  }
                >
                  <Check className="size-4" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={moderate.isPending}
                  onClick={() =>
                    moderate.mutate({ reviewId: review.id, action: "reject" })
                  }
                >
                  <X className="size-4" />
                  Reject
                </Button>
              </div>
            )}
            {review.status === "approved" && (
              <Button
                size="sm"
                variant="ghost"
                className="mt-2 text-muted-foreground"
                disabled={moderate.isPending}
                onClick={() =>
                  moderate.mutate({ reviewId: review.id, action: "reject" })
                }
              >
                <Trash2 className="size-4" />
                Remove from page
              </Button>
            )}
          </div>
        ),
      )}

      {pending.length > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Star className="size-3.5 text-amber-500" />
          {pending.length} pending {pending.length === 1 ? "review" : "reviews"}{" "}
          awaiting your approval
        </p>
      )}
    </div>
  );
}
