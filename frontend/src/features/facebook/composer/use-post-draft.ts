import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "clastor:facebook-composer-draft:v1";

export interface PostDraft {
  message: string;
  images: string[];
}

const EMPTY: PostDraft = { message: "", images: [] };

function readDraft(): PostDraft {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<PostDraft>;
    const message = typeof parsed.message === "string" ? parsed.message : "";
    const images = Array.isArray(parsed.images)
      ? parsed.images.filter((u): u is string => typeof u === "string")
      : [];
    return { message, images };
  } catch {
    return EMPTY;
  }
}

/**
 * Persist the composer's message + images to localStorage so a refresh or
 * stray navigation doesn't lose a half-written post. Autosaves (debounced via
 * the effect) and exposes a `clear` for after a successful publish.
 */
export function usePostDraft() {
  const [draft, setDraft] = useState<PostDraft>(() => readDraft());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setMessage = useCallback((message: string) => {
    setDraft((d) => ({ ...d, message }));
  }, []);

  const setImages = useCallback((images: string[]) => {
    setDraft((d) => ({ ...d, images }));
  }, []);

  const clear = useCallback(() => {
    setDraft(EMPTY);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  }, []);

  // Debounced persistence — avoid hammering localStorage on every keystroke.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    // Don't persist an empty draft; clearing the key keeps storage tidy.
    timer.current = setTimeout(() => {
      try {
        if (draft.message === "" && draft.images.length === 0) {
          localStorage.removeItem(STORAGE_KEY);
        } else {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
        }
      } catch {
        /* ignore */
      }
    }, 400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [draft]);

  return { draft, setMessage, setImages, clear };
}
