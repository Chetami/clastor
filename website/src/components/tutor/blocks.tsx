import { Clock, Globe, Mail, MapPin, Star } from "lucide-react";
import type { AvailabilitySlot, Subject } from "@examify-tms/interfaces";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  formatAvailabilitySlot,
  formatYearsExperience,
  getInitials,
} from "@/lib/profile-utils";

/**
 * Shared building blocks for the public tutor pages, styled in the site's
 * doodle design system (2.5px outlines, sketch shadows, warm palette).
 */

export function TutorAvatar({
  name,
  avatarUrl,
  className,
}: {
  name: string;
  avatarUrl?: string | null;
  className?: string;
}) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={cn("rounded-2xl border-[2.5px] border-foreground object-cover", className)}
      />
    );
  }
  return (
    <div
      aria-hidden
      className={cn(
        "flex items-center justify-center rounded-2xl border-[2.5px] border-foreground bg-secondary font-display text-3xl",
        className,
      )}
    >
      {getInitials(name) || "?"}
    </div>
  );
}

export function Stars({
  ratingAvg,
  reviewCount,
  className,
}: {
  ratingAvg: number | null | undefined;
  reviewCount?: number | null;
  className?: string;
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
      <span className="relative inline-flex">
        <span className="flex text-muted-foreground/30" aria-hidden>
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
      <span className="text-sm font-semibold">{ratingAvg.toFixed(1)}</span>
      {reviewCount != null && (
        <span className="text-sm text-muted-foreground">
          ({reviewCount} {reviewCount === 1 ? "review" : "reviews"})
        </span>
      )}
    </span>
  );
}

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
            star <= value ? "text-amber-500" : "text-muted-foreground/30",
          )}
        >
          <Star className="size-7 fill-current" strokeWidth={0} />
        </button>
      ))}
    </div>
  );
}

export function SubjectChips({
  subjects,
  className,
  max,
}: {
  subjects: Subject[];
  className?: string;
  max?: number;
}) {
  if (subjects.length === 0) return null;
  const shown = max ? subjects.slice(0, max) : subjects;
  const overflow = subjects.length - shown.length;
  return (
    <ul className="flex flex-wrap gap-2">
      {shown.map((subject) => (
        <li
          key={subject.id}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border-2 border-foreground bg-secondary/60 px-3 py-1 text-sm",
            className,
          )}
        >
          {subject.color && (
            <span
              className="size-2 shrink-0 rounded-full border border-foreground/30"
              style={{ backgroundColor: subject.color }}
              aria-hidden
            />
          )}
          {subject.name}
        </li>
      ))}
      {overflow > 0 && (
        <li className={cn("rounded-full border-2 border-foreground bg-secondary/60 px-3 py-1 text-sm", className)}>
          +{overflow} more
        </li>
      )}
    </ul>
  );
}

export function AvailabilityList({
  availability,
  className,
}: {
  availability: AvailabilitySlot[];
  className?: string;
}) {
  if (availability.length === 0) return null;
  return (
    <ul className={cn("space-y-1.5", className)}>
      {availability.map((slot) => (
        <li key={slot.day} className="flex items-center gap-2 text-sm">
          <Clock className="size-4 shrink-0 text-brand" />
          <span>{formatAvailabilitySlot(slot)}</span>
        </li>
      ))}
    </ul>
  );
}

export function DetailBadges({
  location,
  teachesOnline,
  yearsExperience,
}: {
  location?: string | null;
  teachesOnline?: boolean;
  yearsExperience?: number | null;
}) {
  const items: { icon: typeof MapPin; label: string }[] = [];
  if (location) items.push({ icon: MapPin, label: location });
  if (teachesOnline) items.push({ icon: Globe, label: "Teaches online" });
  const experience = formatYearsExperience(yearsExperience);
  if (experience) items.push({ icon: Clock, label: experience });

  if (items.length === 0) return null;
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map(({ icon: Icon, label }) => (
        <li
          key={label}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
        >
          <Icon className="size-4" aria-hidden />
          {label}
        </li>
      ))}
    </ul>
  );
}

export function ContactButton({
  email,
  label,
  variant = "brand",
  size,
  className,
}: {
  email: string | null | undefined;
  label: string;
  variant?: "brand" | "outline" | "default" | "secondary";
  size?: "default" | "sm" | "lg" | "xl";
  className?: string;
}) {
  if (!email) return null;
  return (
    <Button asChild variant={variant} size={size} className={className}>
      <a href={`mailto:${email}`}>
        <Mail className="size-4" />
        {label}
      </a>
    </Button>
  );
}

export function SectionTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "font-mono text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </h2>
  );
}
