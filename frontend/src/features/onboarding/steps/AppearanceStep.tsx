import { Moon, Palette, Sun } from "lucide-react";

import { COLOR_SCHEMES, useTheme, type Appearance } from "@/hooks/use-theme";

const APPEARANCE_OPTIONS: {
  value: Appearance;
  label: string;
  description: string;
  icon: typeof Sun;
}[] = [
  {
    value: "light",
    label: "Light",
    description: "Bright and clean",
    icon: Sun,
  },
  {
    value: "dark",
    label: "Dark",
    description: "Easy on the eyes",
    icon: Moon,
  },
];

/**
 * Appearance step: choose light or dark mode and a colour scheme. Selections
 * persist instantly via the theme provider (localStorage), so navigating away
 * mid-step keeps whatever the user picked.
 */
export function AppearanceStep() {
  const { appearance, setAppearance, colorScheme, setColorScheme } = useTheme();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Palette className="size-6" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight">Make it yours</h2>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          Pick how Clastor looks. You can switch between light and dark mode and
          choose a colour scheme — change it anytime from Settings.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-sm font-medium">Mode</span>
        <div className="grid grid-cols-2 gap-3">
          {APPEARANCE_OPTIONS.map((option) => {
            const selected = option.value === appearance;
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setAppearance(option.value)}
                aria-pressed={selected}
                className={`flex items-center gap-3 rounded-lg border-2 p-4 text-left transition-colors hover:bg-accent ${
                  selected ? "border-primary" : "border-transparent bg-muted/40"
                }`}
              >
                <span className="flex size-9 items-center justify-center rounded-full bg-background text-foreground shadow-sm">
                  <Icon className="size-4" />
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-medium leading-tight">
                    {option.label}
                  </span>
                  <span className="text-xs leading-tight text-muted-foreground">
                    {option.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-sm font-medium">Colour scheme</span>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {COLOR_SCHEMES.map((scheme) => {
            const selected = scheme.value === colorScheme;
            return (
              <button
                key={scheme.value}
                type="button"
                onClick={() => setColorScheme(scheme.value)}
                aria-pressed={selected}
                className={`flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-colors hover:bg-accent ${
                  selected ? "border-primary" : "border-transparent bg-muted/40"
                }`}
              >
                <span className="flex -space-x-2">
                  <span
                    className="size-7 rounded-full ring-2 ring-background"
                    style={{ backgroundColor: scheme.swatch }}
                  />
                  {scheme.secondary && (
                    <span
                      className="size-7 rounded-full ring-2 ring-background"
                      style={{ backgroundColor: scheme.secondary }}
                    />
                  )}
                  <span
                    className="size-7 rounded-full ring-2 ring-background"
                    style={{ backgroundColor: scheme.accent }}
                  />
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-medium leading-tight">
                    {scheme.label}
                  </span>
                  <span
                    className={`text-xs leading-tight ${
                      selected ? "text-muted-foreground" : "text-transparent"
                    }`}
                  >
                    Active
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
