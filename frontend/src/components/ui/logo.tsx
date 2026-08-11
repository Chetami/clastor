import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: number;
}

export function Logo({ className = "", size = 40 }: LogoProps) {
  return (
    <img
      src="/logo.png"
      alt="Clastor"
      width={size}
      height={size}
      className={cn("shrink-0 rounded-md", className)}
      style={{ borderRadius: '0.375rem' }}
    />
  );
}