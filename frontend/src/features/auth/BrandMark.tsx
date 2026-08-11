import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
  /** Size of the logo square in px. */
  size?: number;
};

export function BrandMark({ className, size = 40 }: BrandMarkProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <img
        src="/logo.png"
        alt="Clastor"
        className="rounded-lg shadow-sm"
        style={{ width: size, height: size }}
      />
      <span className="text-xl font-semibold tracking-tight">Clastor</span>
    </div>
  );
}
