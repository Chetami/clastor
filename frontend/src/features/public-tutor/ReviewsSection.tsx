import { useState } from "react";
import { Loader2, MessageSquarePlus, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreatePublicReview, usePublicReviews } from "@examify-tms/shared";
import { RatingStars, StarPicker, SectionTitle } from "./templates/blocks";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
  });
}

/**
 * Public reviews for a tutor profile: approved reviews list plus a
 * "leave a review" form. Submissions start pending and appear only after
 * the tutor approves them, which the success note explains.
 */
export function ReviewsSection({ slug }: { slug: string }) {
  const { data, isLoading } = usePublicReviews(slug);
  const createReview = useCreatePublicReview(slug);
  const [formOpen, setFormOpen] = useState(false);

  const [authorName, setAuthorName] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reviews = data?.items ?? [];
  const submitted = createReview.isSuccess;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (rating < 1) {
      setError("Please choose a star rating.");
      return;
    }
    try {
      await createReview.mutateAsync({
        authorName: authorName.trim(),
        rating,
        comment: comment.trim() || null,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to submit review.",
      );
    }
  }

  return (
    <section className="mx-auto max-w-3xl px-4 pb-16 pt-4">
      <div className="flex items-center justify-between gap-4">
        <SectionTitle>Reviews</SectionTitle>
        {!formOpen && !submitted && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFormOpen(true)}
          >
            <MessageSquarePlus className="size-4" />
            Leave a review
          </Button>
        )}
      </div>

      {submitted && (
        <p className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
          Thanks! Your review was submitted and will appear once{" "}
          {"it's"} approved.
        </p>
      )}

      {!submitted && formOpen && (
        <form
          onSubmit={handleSubmit}
          className="mt-4 space-y-4 rounded-xl border bg-muted/30 p-4"
        >
          <div className="space-y-2">
            <Label htmlFor="review-name">Your name</Label>
            <Input
              id="review-name"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="Sarah M."
              maxLength={60}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Your rating</Label>
            <StarPicker
              value={rating}
              onChange={setRating}
              disabled={createReview.isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="review-comment">
              Your review{" "}
              <span className="text-xs font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Textarea
              id="review-comment"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What was your experience like?"
              maxLength={1000}
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={createReview.isPending}>
              {createReview.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Submit review
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setFormOpen(false)}
              disabled={createReview.isPending}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      <div className="mt-4 space-y-3">
        {isLoading &&
          Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="flex animate-pulse gap-3 rounded-xl border p-4"
            >
              <Star className="size-5 text-muted-foreground/30" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-24 rounded bg-muted" />
                <div className="h-3 w-full rounded bg-muted" />
              </div>
            </div>
          ))}

        {!isLoading && reviews.length === 0 && (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No reviews yet. Be the first to share your experience.
          </p>
        )}

        {reviews.map((review) => (
          <article key={review.id} className="rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">{review.authorName}</span>
                <RatingStars ratingAvg={review.rating} />
              </div>
              <time className="text-xs text-muted-foreground">
                {formatDate(review.createdAt)}
              </time>
            </div>
            {review.comment && (
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                {review.comment}
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
