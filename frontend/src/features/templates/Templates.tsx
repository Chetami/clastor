import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FileText,
  Mail,
  Video,
  CalendarClock,
  CalendarX,
  CalendarDays,
  Repeat,
  Ban,
  SquarePen,
  Receipt,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useTemplates,
  useEmailTemplatePreview,
  useInvoiceTemplatePreview,
} from "./api";
import { EmailPreview } from "./components/EmailPreview";
import { InvoicePreview } from "./components/InvoicePreview";

const TEMPLATE_ICONS: Record<string, LucideIcon> = {
  "lesson-reminder": Mail,
  "meet-invite": Video,
  reschedule: CalendarClock,
  cancellation: CalendarX,
  "series-notification": CalendarDays,
  "series-reschedule": Repeat,
  "series-cancellation": Ban,
  invoice: FileText,
  "invoice-email": Receipt,
};

export default function Templates() {
  const { data: templates, isLoading, isError } = useTemplates();
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  const selected = useMemo(() => {
    const list = templates ?? [];
    if (!list.length) return undefined;
    return list.find((t) => t.id === selectedId) ?? list[0];
  }, [templates, selectedId]);

  const grouped = useMemo(() => {
    const list = templates ?? [];
    const groups: { name: string; items: typeof list }[] = [];
    for (const t of list) {
      const last = groups[groups.length - 1];
      if (last && last.name === t.group) {
        last.items.push(t);
      } else {
        groups.push({ name: t.group, items: [t] });
      }
    }
    return groups;
  }, [templates]);

  const isEmail = selected?.type === "email";
  const isPdf = selected?.type === "pdf";

  const emailPreview = useEmailTemplatePreview(selected?.id, isEmail);
  const invoicePreview = useInvoiceTemplatePreview(isPdf);

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col gap-6 overflow-hidden">
      <div className="shrink-0">
        <h2 className="text-lg font-semibold tracking-tight">Templates</h2>
        <p className="text-sm text-muted-foreground">
          A preview of what gets sent to your students and their families.
          Customise your invoice details in{" "}
          <Link
            to="/settings"
            className="text-foreground underline underline-offset-4"
          >
            Settings
          </Link>
          .
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden lg:flex-row">
        {/* Left: template selector */}
        <nav className="min-h-0 space-y-2 overflow-y-auto px-1 pb-1 [&::-webkit-scrollbar]:hidden [scrollbar-width:none] lg:w-[280px] lg:shrink-0">
          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          ) : isError || !templates ? (
            <p className="text-sm text-muted-foreground">
              Couldn’t load templates. Please try again later.
            </p>
          ) : (
            grouped.map((group) => (
              <div key={group.name} className="space-y-1.5">
                <h3 className="px-1 pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {group.name}
                </h3>
                {group.items.map((t) => {
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
                })}
              </div>
            ))
          )}
        </nav>

        {/* Right: preview pane */}
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          {selected && (
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium">{selected.name}</span>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0} className="inline-flex">
                      <Button variant="outline" size="sm" disabled>
                        <SquarePen className="mr-2 h-3.5 w-3.5" />
                        Edit
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    Template editing will be available later
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
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
