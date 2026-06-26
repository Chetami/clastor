import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface InvoicePreviewProps {
  blob: Blob | undefined;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Embed the invoice template PDF so the tutor sees exactly what gets attached
 * to invoice emails. Manages its own object URL, revoked whenever the blob
 * changes or the component unmounts.
 */
export function InvoicePreview({
  blob,
  isLoading,
  isError,
}: InvoicePreviewProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);

  if (isLoading) {
    return <Skeleton className="h-[680px] w-full rounded-lg" />;
  }

  if (isError || !url) {
    return (
      <p className="text-sm text-muted-foreground">
        Couldn’t load the invoice preview.
      </p>
    );
  }

  return (
    <iframe
      title="Invoice template preview"
      src={url}
      className="h-[680px] w-full rounded-lg border bg-white"
    />
  );
}
