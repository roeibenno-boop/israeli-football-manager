import { StyleSheet, View } from 'react-native';

import type { FatigueLevel } from '@/lib/fatigue';
import { fatigueColors } from '@/theme';

type FatigueDotProps = {
  level: FatigueLevel;
  size?: number;
};

/** Green / amber / red — meant to sit right next to a player's name. */
export function FatigueDot({ level, size = 8 }: FatigueDotProps) {
  return (
    <View
      style={[
        styles.dot,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: fatigueColors[level] },
      ]}
      accessibilityLabel={`Fatigue: ${level}`}
    />
  );
}

const styles = StyleSheet.create({
  dot: {
    flexShrink: 0,
  },
});
