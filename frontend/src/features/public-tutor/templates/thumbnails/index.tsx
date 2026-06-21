/**
 * Purely decorative sketches of each template's layout, shown on the picker
 * card. They intentionally use no real data — just enough shapes to telegraph
 * the arrangement. Add a `Thumbnail` per template in the registry.
 */

export function ClassicThumb() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-background p-4">
      <div className="size-9 rounded-full bg-primary/15 ring-1 ring-primary/10" />
      <div className="h-2.5 w-24 rounded-full bg-foreground/70" />
      <div className="h-1.5 w-16 rounded-full bg-muted-foreground/50" />
      <div className="mt-1 flex gap-1.5">
        <div className="h-3 w-9 rounded-full border border-input bg-muted/40" />
        <div className="h-3 w-9 rounded-full border border-input bg-muted/40" />
        <div className="h-3 w-9 rounded-full border border-input bg-muted/40" />
      </div>
    </div>
  );
}

export function ModernThumb() {
  return (
    <div className="grid h-full w-full grid-cols-2 overflow-hidden">
      <div className="flex flex-col justify-center gap-2 bg-primary p-4">
        <div className="size-6 rounded-lg bg-primary-foreground/25 ring-1 ring-primary-foreground/20" />
        <div className="h-2 w-12 rounded-full bg-primary-foreground/80" />
        <div className="h-1.5 w-9 rounded-full bg-primary-foreground/45" />
        <div className="mt-1 h-3 w-14 rounded-md bg-primary-foreground/20" />
      </div>
      <div className="flex flex-col justify-center gap-2 bg-muted/40 p-4">
        <div className="h-1.5 w-full rounded-full bg-foreground/35" />
        <div className="h-1.5 w-3/4 rounded-full bg-foreground/25" />
        <div className="h-1.5 w-2/3 rounded-full bg-foreground/20" />
      </div>
    </div>
  );
}
