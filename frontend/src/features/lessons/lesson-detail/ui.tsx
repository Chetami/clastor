import { useRef, useLayoutEffect } from "react";
import { Check, Loader2 } from "lucide-react";

interface DetailRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

export function DetailRow({ icon, label, value }: DetailRowProps) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

/** Saved / Saving… / Edited status chip for the notes card header. */
export function NotesStatus({
  dirty,
  saving,
}: {
  dirty: boolean;
  saving: boolean;
}) {
  if (saving)
    return (
      <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Saving…
      </span>
    );
  if (dirty)
    return (
      <span className="text-xs font-normal text-muted-foreground">Edited</span>
    );
  return (
    <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
      <Check className="h-3 w-3 text-emerald-500" />
      Saved
    </span>
  );
}

interface AutoGrowTextareaProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onBlur: () => void;
  className?: string;
}

/** A textarea that grows to fit its content (used by checklist items). */
export function AutoGrowTextarea({
  value,
  onChange,
  onBlur,
  className,
}: AutoGrowTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      rows={1}
      className={className}
    />
  );
}
