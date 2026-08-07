import { Check, Eye, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { useCheckSlug } from "../api/use-check-slug";

export type View = "editor" | "preview";

/** Editor / Preview segmented toggle. */
export function ViewToggle({
  view,
  onChange,
}: {
  view: View;
  onChange: (v: View) => void;
}) {
  const options: { value: View; label: string; icon: typeof Pencil }[] = [
    { value: "editor", label: "Editor", icon: Pencil },
    { value: "preview", label: "Preview", icon: Eye },
  ];
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border bg-muted/50 p-0.5">
      {options.map((opt) => {
        const active = view === opt.value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/** Published / Draft status pill. */
export function StatusChip({ published }: { published: boolean }) {
  if (published) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        Published
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600">
      <span className="size-1.5 rounded-full bg-amber-500" />
      Draft
    </span>
  );
}

/** Live availability check for the chosen page slug. */
export function SlugStatus({
  slug,
  slugCheck,
}: {
  slug: string;
  slugCheck: ReturnType<typeof useCheckSlug>;
}) {
  if (slug.trim().length === 0) return null;

  if (slugCheck.isFetching) {
    return (
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> Checking…
      </p>
    );
  }
  if (slugCheck.data?.available) {
    return (
      <p className="flex items-center gap-1 text-xs text-primary">
        <Check className="size-3" /> Available
      </p>
    );
  }
  if (slugCheck.data && !slugCheck.data.available) {
    return (
      <p className="flex items-center gap-1 text-xs text-destructive">
        <X className="size-3" /> That slug is taken or reserved.
      </p>
    );
  }
  return null;
}

/** Add / remove editor for a repeating string list (subjects, qualifications). */
export function ListEditor({
  label,
  placeholder,
  items,
  onAdd,
  onChange,
  onRemove,
}: {
  label: string;
  placeholder: string;
  items: string[];
  onAdd: () => void;
  onChange: (index: number, value: string) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              placeholder={placeholder}
              value={item}
              onChange={(e) => onChange(i, e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => onRemove(i)}
              aria-label={`Remove ${label.toLowerCase()} ${i + 1}`}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onAdd}>
        <Plus className="size-4" />
        Add {label.toLowerCase().replace(/s$/, "")}
      </Button>
    </div>
  );
}
