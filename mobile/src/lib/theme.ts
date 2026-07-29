/**
 * Centralised colour palette + spacing tokens for the mobile app. Mirrors the
 * web app's shadcn/Tailwind slate + blue-500 primary, expressed as plain hex
 * so they work with React Native `StyleSheet`.
 */
export const colors = {
  // Brand
  primary: "#208AEF",
  primaryTint: "#EAF3FE",

  // Slate scale (foreground/backgrounds)
  ink: "#0f172a", // foreground
  inkSoft: "#334155",
  muted: "#64748b", // muted-foreground
  mutedSoft: "#94a3b8",
  line: "#e2e8f0", // borders
  surface: "#ffffff",
  surfaceAlt: "#f8fafc", // subtle card / input bg

  // Semantic
  success: "#059669",
  successTint: "#d1fae5",
  warning: "#d97706",
  warningTint: "#fef3c7",
  danger: "#b91c1c",
  dangerTint: "#fee2e2",
  amber: "#f59e0b",
  emerald: "#10b981",
  rose: "#f43f5e",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

/** Card radius used throughout the app. */
export const cardRadius = 14;
