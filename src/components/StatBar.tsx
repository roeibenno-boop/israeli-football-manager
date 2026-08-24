import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { baseColors, typography } from '@/theme';

type StatBarProps = {
  label: string;
  /** 0-100 (or nullable if not yet computed). */
  value: number | null;
  color?: string;
  /** Show the numeric value next to the label. Default true. */
  showValue?: boolean;
};

/** A single labelled horizontal bar, animated in on mount/value change. */
export function StatBar({ label, value, color = baseColors.accentFallback, showValue = true }: StatBarProps) {
  const clamped = value == null ? 0 : Math.max(0, Math.min(100, value));
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(clamped, { duration: 500 });
  }, [clamped, width]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
  }));

  return (
    <View style={styles.row}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {showValue && <Text style={styles.value}>{value ?? '—'}</Text>}
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, animatedStyle, { backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 4,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    ...typography.eyebrow,
    color: baseColors.textSecondary,
  },
  value: {
    ...typography.numericMD,
    color: baseColors.textPrimary,
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: baseColors.surfaceElevated,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
});
