import { useState } from "react";
import { Globe, MessageCircle, Share2, ThumbsUp } from "lucide-react";

import { cn } from "@/lib/utils";

interface PostPreviewProps {
  pageName: string | null;
  message: string;
  images: string[];
}

/**
 * A faithful, read-only mock of how the post will appear on a Facebook feed:
 * page identity header, the message (line breaks preserved), an adaptive image
 * grid that mirrors Facebook's photo layouts, and the engagement action row.
 * Purely cosmetic — nothing here is interactive or published.
 */
export function PostPreview({ pageName, message, images }: PostPreviewProps) {
  const name = pageName?.trim() || "Your Page";
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  const empty = message.trim() === "" && images.length === 0;

  return (
    <div className="overflow-hidden rounded-xl border bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100">
      {/* Header */}
      <div className="flex items-center gap-2.5 p-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#1877F2] to-[#4ca0ff] text-sm font-semibold text-white">
          {initials || "P"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold leading-tight">
            {name}
          </p>
          <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            Just now · <Globe className="size-3" />
          </p>
        </div>
      </div>

      {/* Message */}
      {message.trim() !== "" && (
        <div className="px-3 pb-2">
          <p className="whitespace-pre-wrap break-words text-[15px] leading-snug">
            {message}
          </p>
        </div>
      )}

      {/* Media / empty hint */}
      {images.length > 0 ? (
        <ImageGrid urls={images} />
      ) : (
        empty && (
          <div className="flex items-center justify-center px-3 pb-6 pt-1 text-sm text-slate-400 dark:text-slate-500">
            Your post preview will appear here as you type.
          </div>
        )
      )}

      {/* Engagement row */}
      <div className="flex items-center justify-around border-t border-slate-200 p-1 text-slate-600 dark:border-slate-700 dark:text-slate-300">
        <FakeAction icon={<ThumbsUp className="size-4" />} label="Like" />
        <FakeAction icon={<MessageCircle className="size-4" />} label="Comment" />
        <FakeAction icon={<Share2 className="size-4" />} label="Share" />
      </div>
    </div>
  );
}

function FakeAction({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm font-medium opacity-90">
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </div>
  );
}

/**
 * Adaptive multi-photo grid that echoes Facebook's layouts:
 * 1 → single hero; 2 → side by side; 3 → one large + two stacked;
 * 4 → 2×2; 5+ → three columns with a "+N" overflow on the last cell.
 */
function ImageGrid({ urls }: { urls: string[] }) {
  const count = urls.length;

  if (count === 1) {
    return <PreviewImage src={urls[0]} className="w-full" square={false} />;
  }

  if (count === 2) {
    return (
      <div className="grid grid-cols-2 gap-0.5">
        {urls.slice(0, 2).map((u) => (
          <PreviewImage key={u} src={u} className="aspect-square" />
        ))}
      </div>
    );
  }

  if (count === 3) {
    return (
      <div className="grid grid-cols-2 gap-0.5">
        <PreviewImage src={urls[0]} className="aspect-square" />
        <div className="grid grid-rows-2 gap-0.5">
          <PreviewImage src={urls[1]} className="aspect-[2/1]" />
          <PreviewImage src={urls[2]} className="aspect-[2/1]" />
        </div>
      </div>
    );
  }

  if (count === 4) {
    return (
      <div className="grid grid-cols-2 gap-0.5">
        {urls.slice(0, 4).map((u) => (
          <PreviewImage key={u} src={u} className="aspect-square" />
        ))}
      </div>
    );
  }

  // 5+: show up to 5 in a 3-col grid, overlay the count on the last visible.
  const shown = urls.slice(0, 5);
  const overflow = count - 5;
  return (
    <div className="grid grid-cols-3 gap-0.5">
      {shown.map((u, i) => {
        const last = i === shown.length - 1;
        return (
          <PreviewImage
            key={u}
            src={u}
            className="aspect-square"
            overlay={last && overflow > 0 ? `+${overflow}` : undefined}
          />
        );
      })}
    </div>
  );
}

interface PreviewImageProps {
  src: string;
  className?: string;
  /** Force a square-ish crop for grid cells (ignored when `square` is false). */
  square?: boolean;
  overlay?: string;
}

function PreviewImage({ src, className, square = true, overlay }: PreviewImageProps) {
  const [broken, setBroken] = useState(false);

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden bg-slate-100 dark:bg-slate-800",
        square && "aspect-square",
        className,
      )}
    >
      {broken ? (
        <span className="text-xs text-slate-400">Image unavailable</span>
      ) : (
        <img
          src={src}
          alt="Post attachment preview"
          loading="lazy"
          onError={() => setBroken(true)}
          className="size-full object-cover"
        />
      )}
      {overlay && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-2xl font-semibold text-white">
          {overlay}
        </div>
      )}
    </div>
  );
}
