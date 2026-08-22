import { Clock, Globe, MapPin } from "lucide-react";
import type { AvailabilitySlot } from "@examify-tms/interfaces";
import {
  formatAvailabilitySlot,
  formatYearsExperience,
} from "@examify-tms/shared";
import { cn } from "@/lib/utils";

/**
 * Weekly availability list derived from the tutor's working hours. Renders
 * nothing when the tutor hasn't configured working hours.
 */
export function AvailabilityList({
  availability,
  className,
  iconClassName,
}: {
  availability: AvailabilitySlot[];
  className?: string;
  iconClassName?: string;
}) {
  if (availability.length === 0) return null;
  return (
    <ul className={cn("space-y-1.5", className)}>
      {availability.map((slot) => (
        <li key={slot.day} className="flex items-center gap-2 text-sm">
          <Clock className={cn("size-4 shrink-0 text-muted-foreground", iconClassName)} />
          <span className="text-foreground/90">{formatAvailabilitySlot(slot)}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Compact location / online / experience badges shown under a profile's
 * headline. Each piece renders only when provided.
 */
export function DetailBadges({
  location,
  teachesOnline,
  yearsExperience,
  light,
}: {
  location?: string | null;
  teachesOnline?: boolean;
  yearsExperience?: number | null;
  light?: boolean;
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
          className={cn(
            "inline-flex items-center gap-1.5 text-sm",
            light ? "text-primary-foreground/85" : "text-muted-foreground",
          )}
        >
          <Icon className="size-4" aria-hidden />
          {label}
        </li>
      ))}
    </ul>
  );
}
