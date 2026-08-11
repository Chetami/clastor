/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Appearance = "light" | "dark";
export type ColorScheme = "amber" | "emerald" | "rose";

export const COLOR_SCHEMES: {
  value: ColorScheme;
  label: string;
  /** Tinted neutral base (light-mode muted-foreground) — shows the base hue. */
  base: string;
  /** Light-mode primary swatch, used for preview chips. */
  swatch: string;
  /** Dark-mode primary swatch, used for preview chips. */
  darkSwatch: string;
}[] = [
  {
    value: "amber",
    label: "Amber",
    base: "oklch(0.552 0.016 285.938)",
    swatch: "oklch(0.555 0.163 48.998)",
    darkSwatch: "oklch(0.473 0.137 46.201)",
  },
  {
    value: "emerald",
    label: "Emerald",
    base: "oklch(0.542 0.034 322.5)",
    swatch: "oklch(0.508 0.118 165.612)",
    darkSwatch: "oklch(0.432 0.095 166.913)",
  },
  {
    value: "rose",
    label: "Rose",
    base: "oklch(0.56 0.021 213.5)",
    swatch: "oklch(0.514 0.222 16.935)",
    darkSwatch: "oklch(0.455 0.188 13.697)",
  },
];

const APPEARANCE_KEY = "theme";
const COLOR_SCHEME_KEY = "color-scheme";
const DEFAULT_COLOR_SCHEME: ColorScheme = "amber";

/** CSS class applied to <html> for each scheme (amber needs none — falls through to :root). */
const COLOR_SCHEME_CLASSES: Record<ColorScheme, string> = {
  amber: "",
  emerald: "theme-emerald",
  rose: "theme-rose",
};

function getSystemAppearance(): Appearance {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getInitialAppearance(): Appearance {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(APPEARANCE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return getSystemAppearance();
}

function getInitialColorScheme(): ColorScheme {
  if (typeof window === "undefined") return DEFAULT_COLOR_SCHEME;
  const stored = localStorage.getItem(COLOR_SCHEME_KEY) as ColorScheme | null;
  if (stored && stored in COLOR_SCHEME_CLASSES) return stored;
  return DEFAULT_COLOR_SCHEME;
}

type ThemeContextValue = {
  appearance: Appearance;
  colorScheme: ColorScheme;
  setAppearance: (appearance: Appearance) => void;
  toggleAppearance: () => void;
  setColorScheme: (scheme: ColorScheme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearanceState] = useState<Appearance>(
    getInitialAppearance,
  );
  const [colorScheme, setColorScheme] = useState<ColorScheme>(
    getInitialColorScheme,
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", appearance === "dark");
  }, [appearance]);

  // Follow the browser preference when the user hasn't explicitly chosen.
  useEffect(() => {
    if (!window.matchMedia) return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem(APPEARANCE_KEY)) {
        setAppearanceState(e.matches ? "dark" : "light");
      }
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const setAppearance = useCallback((next: Appearance) => {
    localStorage.setItem(APPEARANCE_KEY, next);
    setAppearanceState(next);
  }, []);

  const toggleAppearance = useCallback(
    () =>
      setAppearanceState((prev) => {
        const next = prev === "dark" ? "light" : "dark";
        localStorage.setItem(APPEARANCE_KEY, next);
        return next;
      }),
    [],
  );

  useEffect(() => {
    const html = document.documentElement;
    Object.values(COLOR_SCHEME_CLASSES).forEach((cls) => {
      if (cls) html.classList.remove(cls);
    });
    const cls = COLOR_SCHEME_CLASSES[colorScheme];
    if (cls) html.classList.add(cls);
    localStorage.setItem(COLOR_SCHEME_KEY, colorScheme);
  }, [colorScheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      appearance,
      colorScheme,
      setAppearance,
      toggleAppearance,
      setColorScheme,
    }),
    [appearance, colorScheme, setAppearance, toggleAppearance],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
