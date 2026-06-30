import { useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Link as LinkIcon,
  Upload,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Facebook's attached_media supports up to 10 images per multi-photo post. */
export const MAX_IMAGES = 10;

/** A single attachment, from either a public URL or an uploaded file. */
export type Attachment =
  | { id: string; kind: "url"; url: string }
  | { id: string; kind: "file"; file: File };

/** Naive but good-enough URL check — the backend / FB crawler does the real one. */
function looksLikeUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `att-${Date.now()}-${idCounter}`;
}

interface ImageManagerProps {
  attachments: Attachment[];
  onChange: (next: Attachment[]) => void;
  /** Resolve an attachment to a previewable src (object URL for files). */
  srcOf: (attachment: Attachment) => string;
}

/**
 * Manage the images attached to a post, from two interchangeable sources:
 * pasted public URLs and files uploaded (or dragged) from disk. Both end up in
 * one ordered list that can be reordered and removed. The caller decides how to
 * persist / publish each kind.
 */
export function ImageManager({
  attachments,
  onChange,
  srcOf,
}: ImageManagerProps) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const atLimit = attachments.length >= MAX_IMAGES;

  function addFiles(fileList: FileList | File[]) {
    const incoming = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    if (incoming.length === 0) {
      setError("Only image files are supported.");
      return;
    }
    const room = MAX_IMAGES - attachments.length;
    const accepted = incoming.slice(0, room);
    const dropped = incoming.length - accepted.length;
    const next: Attachment[] = [
      ...attachments,
      ...accepted.map((file) => ({ id: nextId(), kind: "file", file }) as Attachment),
    ];
    onChange(next);
    setError(dropped > 0 ? `${dropped} image(s) skipped — limit is ${MAX_IMAGES}.` : null);
  }

  function addUrl() {
    const value = draft.trim();
    if (!value) return;
    if (!looksLikeUrl(value)) {
      setError("Enter a full https:// image URL.");
      return;
    }
    if (attachments.some((a) => a.kind === "url" && a.url === value)) {
      setError("That image is already added.");
      return;
    }
    onChange([...attachments, { id: nextId(), kind: "url", url: value }]);
    setDraft("");
    setError(null);
  }

  function removeAt(index: number) {
    onChange(attachments.filter((_, i) => i !== index));
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= attachments.length) return;
    const next = [...attachments];
    [next[from], next[to]] = [next[to], next[from]];
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Drop zone + URL row */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
          }}
          disabled={atLimit}
          className={cn(
            "flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-4 py-5 text-center transition-colors",
            "hover:bg-accent/50 disabled:cursor-not-allowed disabled:opacity-50",
            dragging && "border-primary bg-primary/5",
          )}
        >
          <Upload className="size-5 text-muted-foreground" />
          <span className="text-sm font-medium">
            {dragging ? "Drop to upload" : "Upload images"}
          </span>
          <span className="text-xs text-muted-foreground">
            Click or drag & drop · PNG, JPG, GIF up to 10&nbsp;MB
          </span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = ""; // allow re-selecting the same file
          }}
        />

        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2">
            <LinkIcon className="size-4 shrink-0 text-muted-foreground" />
            <Input
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addUrl();
                }
              }}
              placeholder="…or paste a public image URL"
              type="url"
              disabled={atLimit}
              aria-label="Image URL"
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={addUrl}
            disabled={atLimit || !draft.trim()}
            className="shrink-0"
          >
            <ImagePlus className="size-4" />
            Add
          </Button>
        </div>

        {error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {attachments.length}/{MAX_IMAGES} images · uploads go straight to
            Facebook (nothing stored on our side).
          </p>
        )}
      </div>

      {attachments.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {attachments.map((attachment, index) => (
            <Thumb
              key={attachment.id}
              src={srcOf(attachment)}
              index={index}
              total={attachments.length}
              isFile={attachment.kind === "file"}
              onRemove={() => removeAt(index)}
              onLeft={() => move(index, index - 1)}
              onRight={() => move(index, index + 1)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ThumbProps {
  src: string;
  index: number;
  total: number;
  isFile: boolean;
  onRemove: () => void;
  onLeft: () => void;
  onRight: () => void;
}

function Thumb({
  src,
  index,
  total,
  isFile,
  onRemove,
  onLeft,
  onRight,
}: ThumbProps) {
  const [broken, setBroken] = useState(false);

  return (
    <div className="group relative overflow-hidden rounded-lg border bg-muted">
      <div className="aspect-square w-full">
        {broken ? (
          <div className="flex size-full flex-col items-center justify-center gap-1 p-2 text-center">
            <ImagePlus className="size-5 text-muted-foreground" />
            <p className="text-[10px] leading-tight text-muted-foreground">
              Couldn't load preview
            </p>
          </div>
        ) : (
          <img
            src={src}
            alt={`Attachment ${index + 1}`}
            loading="lazy"
            onError={() => setBroken(true)}
            className="size-full object-cover"
          />
        )}
      </div>

      <span className="absolute left-1 top-1 rounded-full bg-background/90 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm">
        {isFile ? "Upload" : "URL"}
      </span>

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove image ${index + 1}`}
        className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm transition-colors hover:bg-background"
      >
        <X className="size-3.5" />
      </button>

      <div
        className={cn(
          "absolute bottom-1 left-1 flex items-center gap-0.5",
          "opacity-0 transition-opacity group-hover:opacity-100",
        )}
      >
        <button
          type="button"
          onClick={onLeft}
          disabled={index === 0}
          aria-label="Move left"
          className="flex size-6 items-center justify-center rounded-full bg-background/90 shadow-sm transition-colors hover:bg-background disabled:opacity-30"
        >
          <ChevronLeft className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={onRight}
          disabled={index === total - 1}
          aria-label="Move right"
          className="flex size-6 items-center justify-center rounded-full bg-background/90 shadow-sm transition-colors hover:bg-background disabled:opacity-30"
        >
          <ChevronRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
