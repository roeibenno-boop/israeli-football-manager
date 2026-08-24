import { StyleSheet, Text, View } from 'react-native';

import { positionColors } from '@/theme';
import type { PlayerPosition } from '@/types';

type PositionPillProps = {
  position: PlayerPosition;
  size?: 'sm' | 'md';
};

/** GK yellow / DF blue / MF green / FW red. */
export function PositionPill({ position, size = 'md' }: PositionPillProps) {
  const colors = positionColors[position];
  const small = size === 'sm';

  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: colors.bg, paddingHorizontal: small ? 6 : 8, paddingVertical: small ? 2 : 3 },
      ]}>
      <Text style={[styles.text, { color: colors.text, fontSize: small ? 10 : 11 }]}>{position}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
