import { useMemo, useState } from "react";
import {
  FileText,
  Mail,
  Video,
  CalendarClock,
  CalendarX,
  type LucideIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useTemplates,
  useEmailTemplatePreview,
  useInvoiceTemplatePreview,
} from "./api";
import { EmailPreview } from "./components/EmailPreview";
import { InvoicePreview } from "./components/InvoicePreview";

const TEMPLATE_ICONS: Record<string, LucideIcon> = {
  invoice: FileText,
  "lesson-reminder": Mail,
  "meet-invite": Video,
  reschedule: CalendarClock,
  cancellation: CalendarX,
};

export default function Templates() {
  const { data: templates, isLoading, isError } = useTemplates();
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  const selected = useMemo(() => {
    const list = templates ?? [];
    if (!list.length) return undefined;
    return list.find((t) => t.id === selectedId) ?? list[0];
  }, [templates, selectedId]);

  const isEmail = selected?.type === "email";
  const isPdf = selected?.type === "pdf";

  const emailPreview = useEmailTemplatePreview(selected?.id, isEmail);
  const invoicePreview = useInvoiceTemplatePreview(isPdf);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Templates</h2>
        <p className="text-sm text-muted-foreground">
          A preview of what gets sent to your students and their families. These
          are for viewing only — customisation is coming soon.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Left: template selector */}
        <nav className="space-y-2">
          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          ) : isError || !templates ? (
            <p className="text-sm text-muted-foreground">
              Couldn’t load templates. Please try again later.
            </p>
          ) : (
            templates.map((t) => {
              const Icon = TEMPLATE_ICONS[t.id] ?? FileText;
              const active = t.id === selected?.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedId(t.id)}
                  aria-current={active ? "true" : undefined}
                  className={[
                    "flex w-full flex-col items-start gap-1.5 rounded-lg border p-4 text-left transition-colors",
                    active
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "hover:bg-accent",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{t.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {t.description}
                  </span>
                </button>
              );
            })
          )}
        </nav>

        {/* Right: preview pane */}
        <div className="min-w-0 lg:sticky lg:top-2 lg:self-start">
          {selected && isEmail && (
            <EmailPreview
              data={emailPreview.data}
              isLoading={emailPreview.isLoading}
              isError={emailPreview.isError}
            />
          )}
          {selected && isPdf && (
            <InvoicePreview
              blob={invoicePreview.data}
              isLoading={invoicePreview.isLoading}
              isError={invoicePreview.isError}
            />
          )}
        </div>
      </div>
    </div>
  );
}
