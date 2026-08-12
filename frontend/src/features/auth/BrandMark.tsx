import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/ui/logo";

type BrandMarkProps = {
  className?: string;
  /** Size of the logo square in px. */
  size?: number;
  /** Whether to show the app name text */
  showName?: boolean;
};

export function BrandMark({ className, size = 40, showName = true }: BrandMarkProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark size={size} />
      {showName && <span className="text-xl font-semibold tracking-tight">Clastor</span>}
    </div>
  );
}
