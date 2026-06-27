import { GraduationCap } from "lucide-react"

import { cn } from "@/lib/utils"

type BrandMarkProps = {
  className?: string
  /** Size of the logo square in px. */
  size?: number
}

export function BrandMark({ className, size = 40 }: BrandMarkProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className="flex items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm"
        style={{ width: size, height: size }}
      >
        <GraduationCap style={{ width: size * 0.55, height: size * 0.55 }} />
      </div>
      <span className="text-xl font-semibold tracking-tight">Clastor</span>
    </div>
  )
}
