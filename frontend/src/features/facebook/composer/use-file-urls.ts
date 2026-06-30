import { useCallback, useEffect, useReducer, useRef } from "react";

/**
 * Lazily create and cache object URLs for uploaded `File`s, so the same file
 * renders a stable preview URL across renders without leaking. URLs are revoked
 * on unmount. (Removed files are left until unmount — they're small and the
 * composer is short-lived.)
 */
export function useFileUrls() {
  const mapRef = useRef<Map<File, string>>(new Map());
  const [, force] = useReducer((x: number) => x + 1, 0);

  const get = useCallback((file: File): string => {
    const map = mapRef.current;
    let url = map.get(file);
    if (!url) {
      url = URL.createObjectURL(file);
      map.set(file, url);
      force();
    }
    return url;
  }, []);

  useEffect(
    () => () => {
      mapRef.current.forEach((url) => URL.revokeObjectURL(url));
      mapRef.current.clear();
    },
    [],
  );

  return get;
}
