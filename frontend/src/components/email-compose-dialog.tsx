import { useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { EmailPreviewResponse } from "@examify-tms/interfaces";

interface EmailComposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  sendLabel?: string;
  /** Render the Send button in the destructive style (e.g. cancellations). */
  destructive?: boolean;
  /**
   * Fetch the rendered preview for the given (possibly edited) message. Called
   * once on open (with an empty message to obtain the defaults) and then
   * debounced on every edit so the tutor sees exactly what will be sent.
   *
   * The subject line and recipient are NOT editable — only the message is — so
   * this only takes the message.
   */
  fetchPreview: (message: string) => Promise<EmailPreviewResponse>;
  /**
   * Send the email with the given message. Throw to surface an error; the
   * dialog stays open so the tutor can retry.
   */
  onSend: (message: string) => Promise<void>;
}

/**
 * Reusable "review & edit before sending" dialog for every outbound email
 * (lesson notify, reschedule, cancel, series notify, invoice).
 *
 * The recipient ("To") and subject line are shown read-only — only the
 * Message body is editable. A live rendered HTML preview (sandboxed iframe)
 * updates as the message is edited, reflecting the auto-generated footer
 * (lesson details, RSVP / Pay buttons, signature). The tutor can never send
 * without seeing the rendered email first.
 */
export function EmailComposeDialog({
  open,
  onOpenChange,
  title,
  description,
  sendLabel = "Send email",
  destructive = false,
  fetchPreview,
  onSend,
}: EmailComposeDialogProps) {
  const [message, setMessage] = useState("");
  const [to, setTo] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [initialLoading, setInitialLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep the latest callbacks without retriggering the debounce effect on
  // every parent render (callers close over flow-specific params).
  const fetchPreviewRef = useRef(fetchPreview);
  fetchPreviewRef.current = fetchPreview;
  const onSendRef = useRef(onSend);
  onSendRef.current = onSend;

  // Sequence guard so an out-of-order preview response can't clobber a newer
  // one (e.g. the tutor typing fast).
  const seqRef = useRef(0);
  const initializedRef = useRef(false);

  // Initial load on open: fetch with no message to obtain the rendered email
  // + the auto-generated default message, then prefill the editable field.
  useEffect(() => {
    if (!open) {
      initializedRef.current = false;
      return;
    }
    let cancelled = false;
    const seq = ++seqRef.current;
    setInitialLoading(true);
    setError(null);
    fetchPreviewRef.current("").then((p) => {
      if (cancelled || seqRef.current !== seq) return;
      setTo(p.to);
      setSubject(p.subject);
      setHtml(p.html);
      setMessage(p.defaultMessage);
      initializedRef.current = true;
      setInitialLoading(false);
    }).catch((e) => {
      if (cancelled) return;
      setInitialLoading(false);
      setError(e instanceof Error ? e.message : "Failed to load email preview");
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Debounced live refresh as the tutor edits the message.
  useEffect(() => {
    if (!open || !initializedRef.current) return;
    setRefreshing(true);
    const seq = ++seqRef.current;
    const timer = setTimeout(() => {
      fetchPreviewRef.current(message).then((p) => {
        if (seqRef.current !== seq) return;
        setTo(p.to);
        setSubject(p.subject);
        setHtml(p.html);
        setRefreshing(false);
      }).catch(() => {
        // Editing errors are non-fatal; keep the last good preview.
        setRefreshing(false);
      });
    }, 450);
    return () => clearTimeout(timer);
  }, [open, message]);

  async function handleSend() {
    setSending(true);
    setError(null);
    try {
      await onSendRef.current(message);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send email");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="pr-8">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {initialLoading ? (
          <div className="flex flex-1 items-center justify-center py-16">
            <Loader2 className="h-5 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-1">
            <div className="grid grid-cols-3 gap-3">
              <div className="min-w-0 space-y-1">
                <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  To
                </Label>
                <div className="truncate rounded-md border border-transparent bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
                  {to.join(", ")}
                </div>
              </div>
              <div className="col-span-2 min-w-0 space-y-1">
                <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Subject
                </Label>
                <div className="truncate rounded-md border border-transparent bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
                  {subject}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ec-message" className="text-xs">
                Message
              </Label>
              <Textarea
                id="ec-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                disabled={sending}
                placeholder="Type a message to the student…"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Preview</Label>
                {refreshing && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <RefreshCw className="h-3 w-3 animate-spin" /> Updating…
                  </span>
                )}
              </div>
              <iframe
                title="Email preview"
                srcDoc={html}
                sandbox=""
                className="min-h-[220px] w-full rounded-md border bg-white"
              />
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending || initialLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            onClick={handleSend}
            disabled={sending || initialLoading}
          >
            {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {sending ? "Sending…" : sendLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
