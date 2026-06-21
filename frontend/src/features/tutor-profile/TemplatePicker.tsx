import { Check } from "lucide-react";
import {
  TEMPLATE_IDS,
  TEMPLATES,
  type TemplateId,
} from "@/features/public-tutor/templates/registry";
import { cn } from "@/lib/utils";

/**
 * Visual template selector. Iterates over the registry, so new templates show
 * up here automatically — no extra wiring. The real layout renders live in the
 * editor's Preview pane; these cards just show the decorative thumbnail.
 */
export function TemplatePicker({
  value,
  onChange,
}: {
  value: TemplateId;
  onChange: (id: TemplateId) => void;
}) {
  return (
    <div
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      role="radiogroup"
      aria-label="Template"
    >
      {TEMPLATE_IDS.map((id) => {
        const def = TEMPLATES[id];
        const Thumb = def.Thumbnail;
        const active = id === value;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(id)}
            className={cn(
              "group relative flex flex-col overflow-hidden rounded-lg border text-left transition-all",
              active
                ? "border-primary ring-2 ring-primary/20"
                : "border-input hover:border-foreground/30",
            )}
          >
            <div className="aspect-[4/3] overflow-hidden border-b bg-muted/30">
              <Thumb />
            </div>
            <div className="flex items-start justify-between gap-2 p-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{def.label}</p>
                <p className="text-xs text-muted-foreground">
                  {def.description}
                </p>
              </div>
              {active && (
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-3" />
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
