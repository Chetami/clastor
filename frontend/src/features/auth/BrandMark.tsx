import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/ui/logo";

type BrandMarkProps = {
  className?: string;
  /** Size of the logo square in px. */
  size?: number;
  /** Whether to show the app name text */
  showName?: boolean;
  /** Optional subtitle rendered under the name (e.g. "Tutor Management"). */
  subtitle?: string;
};

export function BrandMark({ className, size = 40, showName = true, subtitle }: BrandMarkProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark size={size} />
      {showName &&
        (subtitle ? (
          <div className="grid min-w-0 flex-1 text-left leading-tight">
            <span className="font-display text-base tracking-tight">Clastor</span>
            <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
          </div>
        ) : (
          <span className="font-display text-xl tracking-tight">Clastor</span>
        ))}
    </div>
  );
}
