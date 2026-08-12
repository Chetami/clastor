import { Check, type LucideIcon } from "lucide-react";

export function OptionCard({
  selected,
  icon: Icon,
  title,
  subtitle,
  onClick,
}: {
  selected: boolean;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center gap-4 rounded-2xl border p-5 text-left transition-all duration-200 ${
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm"
          : "border-border bg-card hover:border-primary/40 hover:bg-accent/40"
      }`}
    >
      <span
        className={`flex shrink-0 items-center justify-center rounded-xl transition-colors ${
          selected
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground group-hover:text-foreground"
        }`}
      >
        <span className="flex size-12 items-center justify-center">
          <Icon className="size-6" />
        </span>
      </span>
      <span className="flex flex-1 flex-col">
        <span className="text-base font-semibold leading-tight">{title}</span>
        <span className="mt-0.5 text-sm text-muted-foreground">{subtitle}</span>
      </span>
      <span
        className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
          selected
            ? "border-primary bg-primary text-primary-foreground"
            : "border-muted-foreground/30 text-transparent"
        }`}
      >
        <Check className="size-3.5" strokeWidth={3.5} />
      </span>
    </button>
  );
}
