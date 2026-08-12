import * as React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Default explanation shown when a send-email action is disabled because the
 * recipient has no email address.
 */
export const NO_EMAIL_TOOLTIP =
  "This student needs an email before you can send.";

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
 * Reused by every invoice-send and lesson-notify button so the guard + copy
 * stays consistent.
 */
export function EmailGuard({
  hasEmail,
  tooltip = NO_EMAIL_TOOLTIP,
  children,
}: EmailGuardProps) {
  if (hasEmail) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex">
          {React.cloneElement(children, { disabled: true })}
        </span>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
