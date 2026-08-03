// ── Apeps Supplies central theme ────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH for brand colour, spacing, radius, typography.
// When the final Apeps logo + exact brand blue arrive, change ONLY this file
// (and assets/images) — no component hard-codes colours.
//
// Derived from /app/design_guidelines.json. Max font weight is 500 (Medium);
// hierarchy comes from size + colour, never heavy bold.

export const colors = {
  // Surfaces (never pure black)
  surface: "#121214",
  onSurface: "#FFFFFF",
  surfaceSecondary: "#1C1C1F",
  onSurfaceSecondary: "#D4D4D8",
  surfaceTertiary: "#27272A",
  onSurfaceTertiary: "#A1A1AA",
  surfaceInverse: "#FAFAFA",
  onSurfaceInverse: "#121214",

  // Apeps brand blue (placeholder until final asset supplied)
  brand: "#2563EB",
  brandPrimary: "#2563EB",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#3B82F6",
  brandTertiary: "#1E3A8A",
  onBrandTertiary: "#93C5FD",

  // Feedback
  success: "#10B981",
  onSuccess: "#022C22",
  warning: "#F59E0B",
  onWarning: "#451A03",
  error: "#EF4444",
  onError: "#450A0A",
  info: "#3B82F6",

  // Lines
  border: "#27272A",
  borderStrong: "#3F3F46",
  divider: "#27272A",

  overlay: "rgba(0,0,0,0.6)",
  transparent: "transparent",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
} as const;

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

export const fontSize = {
  sm: 12,
  base: 14,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
} as const;

// Never exceed "500" per design guidelines.
export const fontWeight = {
  regular: "400",
  medium: "500",
} as const;

export const type = {
  display: { fontSize: fontSize["2xl"], fontWeight: fontWeight.medium, color: colors.onSurface },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.medium, color: colors.onSurface },
  heading: { fontSize: fontSize.lg, fontWeight: fontWeight.medium, color: colors.onSurface },
  body: { fontSize: fontSize.base, fontWeight: fontWeight.regular, color: colors.onSurfaceSecondary },
  bodyStrong: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: colors.onSurface },
  caption: { fontSize: fontSize.sm, fontWeight: fontWeight.regular, color: colors.onSurfaceTertiary },
} as const;

export const theme = { colors, spacing, radius, fontSize, fontWeight, type };
export type Theme = typeof theme;
