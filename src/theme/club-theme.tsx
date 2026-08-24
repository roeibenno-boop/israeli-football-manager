import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { baseColors } from './colors';

export type ClubTheme = typeof baseColors & {
  /** The selected club's primary colour, or a neutral fallback if unset/no club selected. */
  accent: string;
  /** The selected club's secondary colour, or a neutral fallback. */
  accentSecondary: string;
};

const defaultTheme: ClubTheme = {
  ...baseColors,
  accent: baseColors.accentFallback,
  accentSecondary: baseColors.accentFallbackSecondary,
};

const ClubThemeContext = createContext<ClubTheme>(defaultTheme);

type ClubThemeProviderProps = {
  /** Hex colour, e.g. "#1E4620". Null/undefined falls back to a neutral accent. */
  primaryColour?: string | null;
  secondaryColour?: string | null;
  children: ReactNode;
};

/** Injects the selected club's palette into context for every screen below it. */
export function ClubThemeProvider({ primaryColour, secondaryColour, children }: ClubThemeProviderProps) {
  const theme = useMemo<ClubTheme>(
    () => ({
      ...baseColors,
      accent: primaryColour || baseColors.accentFallback,
      accentSecondary: secondaryColour || baseColors.accentFallbackSecondary,
    }),
    [primaryColour, secondaryColour]
  );

  return <ClubThemeContext.Provider value={theme}>{children}</ClubThemeContext.Provider>;
}

export function useClubTheme(): ClubTheme {
  return useContext(ClubThemeContext);
}
