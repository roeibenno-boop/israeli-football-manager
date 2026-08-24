import { StyleSheet, Text, View } from 'react-native';

import { effectiveOverall, type FatigueLevel } from '@/lib/fatigue';
import { fatigueColors, tierColors, tierForOverall } from '@/theme';

type OverallBadgeProps = {
  overall: number | null;
  /** When provided and not 'fresh', shows "true (effective)" — see effectiveOverall(). */
  fatigueLevel?: FatigueLevel | null;
  size?: 'sm' | 'md' | 'lg';
};

const SIZES = {
  sm: { box: 28, fontSize: 12, bracketFontSize: 9 },
  md: { box: 36, fontSize: 15, bracketFontSize: 10 },
  lg: { box: 56, fontSize: 22, bracketFontSize: 13 },
} as const;

/**
 * Colour-coded by rating tier: 80+ gold, 70-79 silver, 60-69 bronze, below
 * 60 flat grey. The single shared place this behaviour lives — every
 * screen that shows a player's overall goes through this component, so a
 * fatigued player always reads the same way everywhere.
 */
export function OverallBadge({ overall, fatigueLevel, size = 'md' }: OverallBadgeProps) {
  const tier = tierForOverall(overall);
  const colors = tierColors[tier];
  const { box, fontSize, bracketFontSize } = SIZES[size];

  const showEffective = overall != null && fatigueLevel != null && fatigueLevel !== 'fresh';
  const effective = showEffective ? effectiveOverall(overall!, fatigueLevel!) : null;

  return (
    <View style={[styles.badge, { width: showEffective ? undefined : box, minWidth: box, height: box, backgroundColor: colors.bg }]}>
      <Text style={[styles.text, { fontSize, color: colors.text }]} numberOfLines={1}>
        {overall ?? '—'}
        {showEffective && (
          <Text style={[styles.bracket, { fontSize: bracketFontSize, color: fatigueColors[fatigueLevel!] }]}>
            {' '}
            ({effective})
          </Text>
        )}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  text: {
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  bracket: {
    fontWeight: '800',
  },
});
