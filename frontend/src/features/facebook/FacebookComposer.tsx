import { useEffect, useRef, useState } from "react";
import {
  ExternalLink,
  Hash,
  Loader2,
  RotateCcw,
  Send,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePublishFacebookPost } from "./api/use-facebook-posts";
import { useFacebookConnectionStatus } from "./api/use-facebook-connect";
import { EmojiPicker } from "./composer/EmojiPicker";
import { ImageManager, MAX_IMAGES, type Attachment } from "./composer/ImageManager";
import { PostPreview } from "./composer/PostPreview";
import { usePostDraft } from "./composer/use-post-draft";
import { useFileUrls } from "./composer/use-file-urls";
import {
  HASHTAG_SUGGESTIONS,
  POST_TEMPLATES,
  type PostTemplate,
} from "./composer/composer-data";

const MAX_MESSAGE = 5000;

let seedCounter = 0;
/** Seed attachments from the persisted URL draft (files aren't persisted). */
function seedFrom(urls: string[]): Attachment[] {
  return urls
    .filter((u): u is string => typeof u === "string" && u.length > 0)
    .map((url) => ({
      id: `seed-${seedCounter++}`,
      kind: "url",
      url,
    }));
}

/**
 * Compose and publish a post to the tutor's connected Facebook Page.
 *
 * Split into a rich editor (emoji, templates, hashtags, multi-image manager
 * supporting both uploads and URLs) and a live, Facebook-style preview that
 * updates as you type. Drafts autosave to localStorage, and Ctrl/Cmd+Enter
 * publishes instantly.
 */
export function FacebookComposer() {
  const { draft, setMessage, setImages, clear } = usePostDraft();
  const publish = usePublishFacebookPost();
  const statusQuery = useFacebookConnectionStatus();
  const pageName = statusQuery.data?.pageName ?? null;

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [published, setPublished] = useState<{ permalink: string } | null>(null);

  // Unified, ordered attachments. URL attachments are seeded from (and synced
  // back to) the persisted draft; uploaded files live in-memory only.
  const [attachments, setAttachments] = useState<Attachment[]>(() =>
    seedFrom(draft.images),
  );
  const getFileUrl = useFileUrls();

  const message = draft.message;

  // Persist URL attachments back to the draft so they survive a refresh.
  useEffect(() => {
    setImages(
      attachments
        .filter((a): a is Extract<Attachment, { kind: "url" }> => a.kind === "url")
        .map((a) => a.url),
    );
  }, [attachments, setImages]);

  /** Resolve any attachment to a previewable src. */
  function srcOf(a: Attachment): string {
    return a.kind === "url" ? a.url : getFileUrl(a.file);
  }

  const trimmedMessage = message.trim();
  const canPublish =
    !publish.isPending &&
    (trimmedMessage.length > 0 || attachments.length > 0) &&
    message.length <= MAX_MESSAGE;

  /** Insert `text` at the textarea caret, keeping focus and selection sensible. */
  function insertAtCursor(text: string, fallback: "caret" | "end" = "caret") {
    const el = textareaRef.current;
    if (!el) {
      setMessage(message + text);
      return;
    }
    const { selectionStart, selectionEnd } = el;
    const hasSelection = document.activeElement === el;
    if (fallback === "end" || !hasSelection) {
      const next = message + text;
      setMessage(next);
      queueFocus(el, next.length);
      return;
    }
    const next = message.slice(0, selectionStart) + text + message.slice(selectionEnd);
    const caret = selectionStart + text.length;
    setMessage(next);
    queueFocus(el, caret);
  }

  function queueFocus(el: HTMLTextAreaElement, caret: number) {
    // Defer so React has committed the new value before we reposition.
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  }

  function applyTemplate(tpl: PostTemplate) {
    if (message.trim() === "") {
      setMessage(tpl.body);
    } else {
      // Keep existing copy and drop the template below it, separated clearly.
      setMessage(`${message.trimEnd()}\n\n${tpl.body}`);
    }
    setPublished(null);
  }

  function addHashtag(tag: string) {
    // Hashtags read best at the end of a post; suffix with a space for flow.
    const sep = message.length > 0 && !message.endsWith(" ") && !message.endsWith("\n") ? " " : "";
    insertAtCursor(`${sep}${tag} `, "end");
  }

  function autoGrow() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 520)}px`;
  }

  function handlePublish() {
    setPublished(null);
    const urls = attachments
      .filter((a): a is Extract<Attachment, { kind: "url" }> => a.kind === "url")
      .map((a) => a.url);
    const files = attachments
      .filter((a): a is Extract<Attachment, { kind: "file" }> => a.kind === "file")
      .map((a) => a.file);

    publish.mutate(
      {
        message: trimmedMessage,
        imageUrl: urls.length === 0 ? undefined : urls.length === 1 ? urls[0] : urls,
        files: files.length > 0 ? files : undefined,
      },
      {
        onSuccess: (data) => {
          toast.success("Posted to your Facebook Page.");
          setPublished({ permalink: data.permalink });
          clear();
          setAttachments([]);
          if (textareaRef.current) textareaRef.current.style.height = "auto";
        },
        onError: (err) =>
          toast.error(
            err instanceof Error ? err.message : "Failed to publish post.",
          ),
      },
    );
  }

  /** Ctrl/Cmd+Enter publishes; Enter alone inserts a newline as usual. */
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canPublish) {
      e.preventDefault();
      handlePublish();
    }
  }

  const remaining = MAX_MESSAGE - message.length;
  const countTone =
    remaining <= 100
      ? "text-destructive"
      : remaining <= 1000
        ? "text-amber-600 dark:text-amber-500"
        : "text-muted-foreground";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* ── Editor ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle>Create a post</CardTitle>
              <CardDescription>
                Write your post, attach public images, and publish instantly to
                your Facebook Page.
              </CardDescription>
            </div>
            {(message !== "" || attachments.length > 0) && (
              <Button
                variant="ghost"
                size="sm"
                type="button"
                className="text-muted-foreground"
                onClick={() => {
                  clear();
                  setAttachments([]);
                  setPublished(null);
                  if (textareaRef.current) textareaRef.current.style.height = "auto";
                }}
              >
                <RotateCcw className="size-4" />
                Clear
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/40 p-1">
            <EmojiPicker onPick={(e) => insertAtCursor(e)} />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  className="gap-1.5 text-muted-foreground"
                >
                  <Sparkles className="size-4" />
                  Templates
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72">
                <DropdownMenuLabel>Start from a template</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {POST_TEMPLATES.map((tpl) => (
                  <DropdownMenuItem
                    key={tpl.id}
                    onClick={() => applyTemplate(tpl)}
                    className="flex flex-col items-start gap-0.5 py-2"
                  >
                    <span className="text-sm font-medium">{tpl.title}</span>
                    <span className="text-xs text-muted-foreground">{tpl.hint}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  className="gap-1.5 text-muted-foreground"
                >
                  <Hash className="size-4" />
                  Hashtags
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Add a hashtag</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {HASHTAG_SUGGESTIONS.map((tag) => (
                  <DropdownMenuItem key={tag} onClick={() => addHashtag(tag)}>
                    <span className="text-sm">{tag}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Message */}
          <div className="flex flex-col gap-2">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value.slice(0, MAX_MESSAGE));
                autoGrow();
              }}
              onKeyDown={handleKeyDown}
              onInput={autoGrow}
              rows={6}
              placeholder="Announce new slots, a promotion, or a subject you teach…"
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Tip: <kbd className="rounded border bg-muted px-1">Ctrl</kbd>+
                <kbd className="rounded border bg-muted px-1">Enter</kbd> to
                publish
              </p>
              <p className={`text-xs font-medium ${countTone}`}>
                {message.length.toLocaleString()}/{MAX_MESSAGE.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Images */}
          <div className="flex flex-col gap-2">
            <ImageManager
              attachments={attachments}
              srcOf={srcOf}
              onChange={(next) => {
                setAttachments(next.slice(0, MAX_IMAGES));
                setPublished(null);
              }}
            />
          </div>

          {/* Published result */}
          {published && (
            <div className="flex flex-col gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                Your post is live 🎉
              </p>
              <a
                href={published.permalink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 underline underline-offset-2 dark:text-emerald-400"
              >
                View on Facebook <ExternalLink className="size-3.5" />
              </a>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {canPublish
                ? "Ready to publish."
                : trimmedMessage.length === 0 && attachments.length === 0
                  ? "Add a message or an image to publish."
                  : "Publishing…"}
            </p>
            <Button onClick={handlePublish} disabled={!canPublish}>
              {publish.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              Publish post
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Live preview ───────────────────────────────────────── */}
      <div className="flex flex-col gap-2 lg:sticky lg:top-6 lg:self-start">
        <PostPreview
          pageName={pageName}
          message={message}
          images={attachments.map(srcOf)}
        />
      </div>
    </div>
  );
}
