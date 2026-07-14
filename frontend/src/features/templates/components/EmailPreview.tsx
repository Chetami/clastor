import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { EmailTemplatePreview } from "@examify-tms/interfaces";

interface EmailPreviewProps {
  data: EmailTemplatePreview | undefined;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Render an email-based template the way a recipient would see it: an
 * email-client-style header (subject) above the HTML body. The body is
 * rendered verbatim inside a sandboxed iframe so the preview matches the
 * delivered email exactly and can't navigate the app.
 */
export function EmailPreview({ data, isLoading, isError }: EmailPreviewProps) {
  const srcDoc = useMemo(() => {
    if (!data) return "";
    // Wrap in a basic body style so backgrounds adapt to the iframe context.
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;padding:24px;background:#ffffff;color:#111827;}</style></head><body>${data.html}</body></html>`;
  }, [data]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-[420px] w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <p className="text-sm text-muted-foreground">
        Couldn’t load this template preview.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-white">
      <div className="border-b px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Subject
        </p>
        <p className="mt-0.5 text-sm font-semibold text-gray-900">
          {data.subject}
        </p>
      </div>
      <iframe
        title="Email template preview"
        srcDoc={srcDoc}
        sandbox=""
        className="h-[560px] w-full bg-white"
      />
    </div>
  );
}
