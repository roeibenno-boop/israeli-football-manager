import { StyleSheet, Text, View } from 'react-native';

import { tierColors, tierForOverall } from '@/theme';

type OverallBadgeProps = {
  overall: number | null;
  size?: 'sm' | 'md' | 'lg';
};

const SIZES = {
  sm: { box: 28, fontSize: 12 },
  md: { box: 36, fontSize: 15 },
  lg: { box: 56, fontSize: 22 },
} as const;

/** Colour-coded by rating tier: 80+ gold, 70-79 silver, 60-69 bronze, below 60 flat grey. */
export function OverallBadge({ overall, size = 'md' }: OverallBadgeProps) {
  const tier = tierForOverall(overall);
  const colors = tierColors[tier];
  const { box, fontSize } = SIZES[size];

  return (
    <View style={[styles.badge, { width: box, height: box, backgroundColor: colors.bg }]}>
      <Text style={[styles.text, { fontSize, color: colors.text }]}>{overall ?? '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '800',
    letterSpacing: -0.5,
  },
});
