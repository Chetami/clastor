import * as React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuthStore } from "@/store/auth-store";

/**
 * Default explanation shown when a send-email action is disabled because the
 * recipient has no email address.
 */
export const NO_EMAIL_TOOLTIP =
  "This student needs an email before you can send.";

/**
 * Explanation shown when a send-email action is disabled because the signed-in
 * tutor hasn't verified their email address yet.
 */
export const EMAIL_UNVERIFIED_TOOLTIP =
  "Verify your email first — check your inbox for the verification link.";

interface EmailGuardProps {
  /**
   * Whether a usable recipient email exists. When `false` the wrapped button
   * is forced disabled and wrapped in a tooltip that explains why. When `true`
   * the child renders untouched (preserving any of its own `disabled` state).
   */
  hasEmail: boolean;
  /** Tooltip text shown on hover/focus when disabled. */
  tooltip?: string;
  /**
   * A single button-like element. Its `disabled` prop is overridden to `true`
   * when there is no email. Wrapped in a focusable `<span>` so the Radix
   * tooltip can still trigger on a disabled button (which eats pointer
   * events).
   */
  children: React.ReactElement<{ disabled?: boolean }>;
}

/**
 * Conditionally disables a send-email trigger button and surfaces a tooltip
 * explaining that the student has no email. Renders the child untouched when
 * an email is present.
 *
 * Also gates on the signed-in tutor's own email-verification status: sending
 * is disabled while `user.emailVerified === false` (undefined — sessions from
 * older responses — is treated as verified). The backend enforces the same
 * rule via requireVerifiedEmail, so this is UX, not security.
 *
 * Reused by every invoice-send and lesson-notify button so the guard + copy
 * stays consistent.
 */
export function EmailGuard({
  hasEmail,
  tooltip = NO_EMAIL_TOOLTIP,
  children,
}: EmailGuardProps) {
  const user = useAuthStore((s) => s.user);
  // undefined = unknown (legacy session) — don't block.
  const unverified = user?.emailVerified === false;

  if (hasEmail && !unverified) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex">
          {React.cloneElement(children, { disabled: true })}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {unverified ? EMAIL_UNVERIFIED_TOOLTIP : tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
