import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { PublicTutorProfileResponse, PublicTutorReview } from "@examify-tms/interfaces";
import { createPublicReview, getPublicProfile, listPublicReviews } from "@/lib/public-api";
import { Logo } from "@/components/Logo";
import { APP_URL } from "@/lib/site";
import TEMPLATES from "@/components/tutor/templates";
import { SectionTitle, StarPicker, Stars } from "@/components/tutor/blocks";
import { Button } from "@/components/ui/button";

const FIELD =
  "w-full rounded-2xl border-[2.5px] border-foreground bg-card px-4 py-2.5 text-base text-foreground placeholder:text-muted-foreground/70 transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-brand/30";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
  });
}

/** Browser tab + link-preview metadata for the profile. */
function useProfileMeta(profile: PublicTutorProfileResponse | null) {
  useEffect(() => {
    if (!profile) return;
    const previousTitle = document.title;
    document.title = `${profile.name} | Clastor Tutor`;
    let description = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    const created = !description;
    const previousContent = description?.content ?? null;
    if (!description) {
      description = document.createElement("meta");
      description.name = "description";
      document.head.appendChild(description);
    }
    description.content =
      profile.headline ??
      `${profile.name} teaches ${profile.subjects.map((s) => s.name).join(", ")}.`;
    const canonical = document.createElement("link");
    canonical.rel = "canonical";
    canonical.href = `${window.location.origin}/t/${profile.slug}`;
    document.head.appendChild(canonical);
    return () => {
      document.title = previousTitle;
      if (created) description?.remove();
      else if (description && previousContent != null)
        description.content = previousContent;
      canonical.remove();
    };
  }, [profile]);
}

function ReviewsSection({ slug }: { slug: string }) {
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
    <section className="mx-auto max-w-3xl px-5 pb-16">
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
            <label htmlFor="review-name" className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
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
            <span className="block font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              Your rating
            </span>
            <StarPicker value={rating} onChange={setRating} disabled={submitting} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="review-comment" className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
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

/**
 * Public tutor profile (`/t/:slug`) — served from the marketing site so
 * profiles live on the root domain (SEO + shareable URLs). The layout
 * matches the template the tutor picked in the app.
 */
export default function PublicTutorPage() {
  const { slug } = useParams<{ slug: string }>();
  const [profile, setProfile] = useState<PublicTutorProfileResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    let cancelled = false;
    if (!slug) return;
    setStatus("loading");
    getPublicProfile(slug)
      .then((result) => {
        if (cancelled) return;
        setProfile(result);
        setStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setProfile(null);
        setStatus("missing");
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useProfileMeta(profile);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b-2 border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-5 py-4">
          <a href="/" aria-label="Clastor — home">
            <Logo />
          </a>
          <a
            href="/tutors"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-brand hover:underline"
          >
            Browse tutors
          </a>
        </div>
      </header>

      <main className="flex-1">
        {status === "loading" && (
          <div className="mx-auto max-w-3xl px-5 py-12" aria-busy="true">
            <div className="flex animate-pulse items-center gap-4">
              <div className="size-16 rounded-2xl bg-muted" />
              <div className="space-y-2">
                <div className="h-8 w-48 rounded bg-muted" />
                <div className="h-4 w-64 rounded bg-muted" />
              </div>
            </div>
            <div className="mt-10 space-y-2.5">
              <div className="h-4 w-full rounded bg-muted" />
              <div className="h-4 w-full rounded bg-muted" />
              <div className="h-4 w-3/4 rounded bg-muted" />
            </div>
          </div>
        )}

        {status === "missing" && (
          <div className="mx-auto max-w-md px-5 py-24 text-center">
            <p className="eyebrow">404</p>
            <h1 className="mt-4 font-display text-4xl leading-tight">
              Profile not available
            </h1>
            <p className="mt-2 text-muted-foreground">
              This tutor's page doesn't exist or hasn't been published yet.
            </p>
            <div className="mt-6 flex justify-center gap-4">
              <Button asChild variant="outline">
                <a href="/tutors">Browse tutors</a>
              </Button>
              <Button asChild variant="brand">
                <a href={APP_URL}>Go to Clastor</a>
              </Button>
            </div>
          </div>
        )}

        {status === "ready" && profile && (
          <>
            {(() => {
              const Template =
                profile.template in TEMPLATES
                  ? TEMPLATES[profile.template]
                  : TEMPLATES.classic;
              return <Template profile={profile} />;
            })()}
            {slug && <ReviewsSection slug={slug} />}
          </>
        )}
      </main>

      <footer className="border-t-2 border-border">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-1 px-5 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            This page was made with{" "}
            <a
              href="/"
              className="font-semibold text-foreground underline underline-offset-4"
            >
              Clastor
            </a>
            .
          </p>
          <p className="text-xs text-muted-foreground/70">
            Free scheduling, invoicing and student management for tutors.
          </p>
        </div>
      </footer>
    </div>
  );
}
