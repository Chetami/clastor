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
export type ColorScheme =
  | "graphite"
  | "ocean"
  | "emerald"
  | "violet"
  | "rose"
  | "amber"
  | "sunset"
  | "teal"
  | "berry";

export const COLOR_SCHEMES: {
  value: ColorScheme;
  label: string;
  /** Light-mode primary swatch, used for preview chips. */
  swatch: string;
  /** Light-mode accent (secondary) swatch. */
  accent: string;
  /** Light-mode secondary swatch (three-colour schemes only). */
  secondary?: string;
}[] = [
  { value: "graphite", label: "Graphite", swatch: "hsl(0 0% 9%)", accent: "hsl(0 0% 45%)" },
  { value: "ocean", label: "Ocean", swatch: "hsl(221.2 83.2% 53.3%)", accent: "hsl(199.2 89.5% 48.2%)" },
  { value: "emerald", label: "Emerald", swatch: "hsl(142.1 76.2% 36.3%)", accent: "hsl(38 92% 50%)" },
  { value: "violet", label: "Violet", swatch: "hsl(258 90% 52%)", accent: "hsl(292 84% 61%)" },
  { value: "rose", label: "Rose", swatch: "hsl(347 77% 50%)", accent: "hsl(330 81% 60%)" },
  { value: "amber", label: "Amber", swatch: "hsl(33 88% 38%)", accent: "hsl(25 95% 53%)" },
  { value: "sunset", label: "Sunset", swatch: "hsl(0 72% 51%)", secondary: "hsl(21 90% 48%)", accent: "hsl(38 92% 50%)" },
  { value: "teal", label: "Teal", swatch: "hsl(199 89% 42%)", secondary: "hsl(173 80% 35%)", accent: "hsl(142 71% 45%)" },
  { value: "berry", label: "Berry", swatch: "hsl(327 79% 56%)", secondary: "hsl(263 70% 50%)", accent: "hsl(347 77% 50%)" },
];

const APPEARANCE_KEY = "theme";
const COLOR_SCHEME_KEY = "color-scheme";

/** CSS class applied to <html> for each scheme (graphite needs none). */
const COLOR_SCHEME_CLASSES: Record<ColorScheme, string> = {
  graphite: "",
  ocean: "theme-ocean",
  emerald: "theme-emerald",
  violet: "theme-violet",
  rose: "theme-rose",
  amber: "theme-amber",
  sunset: "theme-sunset",
  teal: "theme-teal",
  berry: "theme-berry",
};

function getInitialAppearance(): Appearance {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(APPEARANCE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getInitialColorScheme(): ColorScheme {
  if (typeof window === "undefined") return "graphite";
  const stored = localStorage.getItem(COLOR_SCHEME_KEY) as ColorScheme | null;
  if (stored && stored in COLOR_SCHEME_CLASSES) return stored;
  return "graphite";
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
  const [appearance, setAppearance] = useState<Appearance>(getInitialAppearance);
  const [colorScheme, setColorScheme] = useState<ColorScheme>(
    getInitialColorScheme,
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", appearance === "dark");
    localStorage.setItem(APPEARANCE_KEY, appearance);
  }, [appearance]);

  useEffect(() => {
    const html = document.documentElement;
    Object.values(COLOR_SCHEME_CLASSES).forEach((cls) => {
      if (cls) html.classList.remove(cls);
    });
    const cls = COLOR_SCHEME_CLASSES[colorScheme];
    if (cls) html.classList.add(cls);
    localStorage.setItem(COLOR_SCHEME_KEY, colorScheme);
  }, [colorScheme]);

  const toggleAppearance = useCallback(
    () => setAppearance((prev) => (prev === "dark" ? "light" : "dark")),
    [],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      appearance,
      colorScheme,
      setAppearance,
      toggleAppearance,
      setColorScheme,
    }),
    [appearance, colorScheme, toggleAppearance],
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
