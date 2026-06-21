import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ButtonProps } from "@/components/ui/button";

/**
 * A mailto contact button. Renders nothing when there's no contact email, so
 * templates can drop it inline without their own guard.
 */
export function ContactButton({
  email,
  label,
  variant,
  size,
  className,
}: {
  email: string | null | undefined;
  label: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
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
