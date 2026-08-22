import { useEffect, useState } from "react";
import type { PublicTutorReview } from "@examify-tms/interfaces";
import { createPublicReview, listPublicReviews } from "@/lib/public-api";
import { SectionTitle, StarPicker, Stars } from "./blocks";
import { Button } from "@/components/ui/button";

const FIELD =
  "w-full rounded-2xl border-[2.5px] border-foreground bg-card px-4 py-2.5 text-base text-foreground placeholder:text-muted-foreground/70 transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-brand/30";

const LABEL =
  "mb-1.5 block font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
  });
}

/**
 * Public reviews for a tutor profile: approved list + "leave a review"
 * form. Submissions start pending and appear only after the tutor approves
 * them, which the success note explains.
 */
export function ReviewsSection({ slug }: { slug: string }) {
  const [reviews, setReviews] = useState<PublicTutorReview[] | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [authorName, setAuthorName] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listPublicReviews(slug)
      .then((result) => {
        if (!cancelled) setReviews(result.items);
      })
      .catch(() => {
        if (!cancelled) setReviews([]);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (rating < 1) {
      setError("Please choose a star rating.");
      return;
    }
    setSubmitting(true);
    try {
      await createPublicReview(slug, {
        authorName: authorName.trim(),
        rating,
        comment: comment.trim() || null,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit review.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between gap-4">
        <SectionTitle>Reviews</SectionTitle>
        {!formOpen && !submitted && (
          <Button variant="outline" size="sm" onClick={() => setFormOpen(true)}>
            Leave a review
          </Button>
        )}
      </div>

      {submitted && (
        <p className="mt-3 rounded-2xl border-[2.5px] border-foreground bg-secondary/60 px-4 py-3 text-sm">
          Thanks! Your review was submitted and will appear once it's approved.
        </p>
      )}

      {!submitted && formOpen && (
        <form
          onSubmit={handleSubmit}
          className="mt-4 space-y-4 rounded-3xl border-[2.5px] border-foreground bg-secondary/40 p-4"
        >
          <div className="space-y-1.5">
            <label htmlFor="review-name" className={LABEL}>
              Your name
            </label>
            <input
              id="review-name"
              className={FIELD}
              placeholder="Sarah M."
              maxLength={60}
              required
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <span className={LABEL}>Your rating</span>
            <StarPicker value={rating} onChange={setRating} disabled={submitting} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="review-comment" className={LABEL}>
              Your review (optional)
            </label>
            <textarea
              id="review-comment"
              rows={3}
              maxLength={1000}
              className={FIELD}
              placeholder="What was your experience like?"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={submitting}>
              Submit review
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setFormOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      <div className="mt-4 space-y-3">
        {reviews === null &&
          Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-3xl border-[2.5px] border-border bg-muted"
            />
          ))}

        {reviews !== null && reviews.length === 0 && (
          <p className="rounded-3xl border-[2.5px] border-dashed border-border p-6 text-center text-muted-foreground">
            No reviews yet. Be the first to share your experience.
          </p>
        )}

        {reviews?.map((review) => (
          <article
            key={review.id}
            className="rounded-3xl border-[2.5px] border-foreground bg-card p-4 shadow-sketch"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{review.authorName}</span>
                <Stars ratingAvg={review.rating} />
              </div>
              <time className="text-xs text-muted-foreground">
                {formatDate(review.createdAt)}
              </time>
            </div>
            {review.comment && (
              <p className="mt-2 whitespace-pre-line leading-relaxed text-muted-foreground">
                {review.comment}
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
