import type { PublicTutorProfileResponse } from "@examify-tms/interfaces";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { getInitials } from "./profile-utils";

/**
 * Avatar that falls back to the tutor's initials. The shape and sizing are
 * driven entirely by `className`, so each template controls its own look.
 */
export function ProfileAvatar({
  profile,
  className,
  fallbackClassName,
}: {
  profile: PublicTutorProfileResponse;
  className?: string;
  fallbackClassName?: string;
}) {
  return (
    <Avatar className={className}>
      {profile.avatarUrl && (
        <AvatarImage src={profile.avatarUrl} alt={profile.name} />
      )}
      <AvatarFallback className={fallbackClassName}>
        {getInitials(profile.name) || "?"}
      </AvatarFallback>
    </Avatar>
  );
}

/** Section title used by every template — same uppercase tracked label. */
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
        "text-sm font-semibold uppercase tracking-wide text-muted-foreground",
        className,
      )}
    >
      {children}
    </h2>
  );
}
