// Dark-only base palette. This product doesn't adapt to system light/dark —
// it's a fixed broadcast-style dark theme, tinted per-club via club-theme.tsx.

export const baseColors = {
  background: '#0B0B0D',
  surface: '#17171B',
  surfaceElevated: '#1F1F24',
  surfacePressed: '#26262C',
  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.16)',

  textPrimary: '#F5F5F7',
  textSecondary: '#9A9AA2',
  textTertiary: '#65656D',
  textInverse: '#0B0B0D',

  // Fallback club accent, used until a club's real colours are known
  // (e.g. before 0006_club_identity.sql has been backfilled).
  accentFallback: '#4C8DF2',
  accentFallbackSecondary: '#1F1F24',
} as const;

/** Position pill colours (background) + the text colour that reads on them. */
export const positionColors = {
  GK: { bg: '#F2C94C', text: '#1A1400' },
  DF: { bg: '#4C8DF2', text: '#00102B' },
  MF: { bg: '#3ECF6B', text: '#00210C' },
  FW: { bg: '#F2544C', text: '#2B0300' },
} as const;

/** Overall-rating tiers: 80+ gold, 70-79 silver, 60-69 bronze, below 60 flat grey. */
export const tierColors = {
  gold: { bg: '#F2C94C', text: '#1A1400' },
  silver: { bg: '#C9CDD6', text: '#1A1B1F' },
  bronze: { bg: '#C98A4C', text: '#1F1200' },
  grey: { bg: '#3A3A40', text: '#C9CDD6' },
} as const;

export type OverallTier = keyof typeof tierColors;

export function tierForOverall(overall: number | null): OverallTier {
  if (overall == null) return 'grey';
  if (overall >= 80) return 'gold';
  if (overall >= 70) return 'silver';
  if (overall >= 60) return 'bronze';
  return 'grey';
}
