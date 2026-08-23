import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Five-star rating display. Filled stars track the average (rounded to the
 * nearest half via clip width); an optional review count renders beside it.
 */
export function RatingStars({
  ratingAvg,
  reviewCount,
  className,
  starClassName,
}: {
  ratingAvg: number | null | undefined;
  reviewCount?: number | null;
  className?: string;
  starClassName?: string;
}) {
  if (ratingAvg == null) return null;
  const pct = Math.max(0, Math.min(100, (ratingAvg / 5) * 100));
  return (
    <span
      className={cn("inline-flex items-center gap-1.5", className)}
      aria-label={`Rated ${ratingAvg.toFixed(1)} out of 5${
        reviewCount != null ? ` from ${reviewCount} reviews` : ""
      }`}
    >
      <span className={cn("relative inline-flex", starClassName)}>
        <span className="flex text-muted-foreground/40" aria-hidden>
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="size-4 fill-current" strokeWidth={0} />
          ))}
        </span>
        <span
          className="absolute inset-0 flex overflow-hidden text-amber-500"
          style={{ width: `${pct}%` }}
          aria-hidden
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="size-4 shrink-0 fill-current" strokeWidth={0} />
          ))}
        </span>
      </span>
      <span className="text-sm font-medium">{ratingAvg.toFixed(1)}</span>
      {reviewCount != null && (
        <span className="text-sm text-muted-foreground">
          ({reviewCount} {reviewCount === 1 ? "review" : "reviews"})
        </span>
      )}
    </span>
  );
}

/** Interactive star picker for the public review form. */
export function StarPicker({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Your rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star === 1 ? "" : "s"}`}
          disabled={disabled}
          onClick={() => onChange(star)}
          className={cn(
            "rounded p-0.5 transition-transform hover:scale-110 disabled:pointer-events-none",
            star <= value ? "text-amber-500" : "text-muted-foreground/40",
          )}
        >
          <Star className="size-6 fill-current" strokeWidth={0} />
        </button>
      ))}
    </div>
  );
}
