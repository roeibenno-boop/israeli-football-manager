import { StyleSheet, Text, View } from 'react-native';

import { baseColors } from '@/theme';

type FormGuideProps = {
  /** e.g. "WWDLW" -- oldest first, most recent last (matches how form_string is stored). */
  formString: string | null;
  size?: 'sm' | 'md';
};

const RESULT_COLOR: Record<'W' | 'D' | 'L', string> = {
  W: '#3ECF6B',
  D: '#5C5C64',
  L: '#F2544C',
};

/** Last five results as pills, oldest left / most recent right. */
export function FormGuide({ formString, size = 'md' }: FormGuideProps) {
  const results = (formString ?? '').split('') as Array<'W' | 'D' | 'L'>;
  const dim = size === 'sm' ? 16 : 20;
  const fontSize = size === 'sm' ? 9 : 10;

  if (results.length === 0) {
    return <Text style={styles.empty}>No form yet</Text>;
  }

  return (
    <View style={styles.row}>
      {results.map((result, index) => (
        <View
          key={index}
          style={[styles.pill, { width: dim, height: dim, borderRadius: dim / 2, backgroundColor: RESULT_COLOR[result] }]}>
          <Text style={[styles.pillText, { fontSize }]}>{result}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * "78 +3.0" (green) / "78 -2.4" (red) next to a rating — just the
 * signed number, the caller supplies the "78". Renders nothing at all
 * when momentum rounds to 0.0, per spec ("nothing when it rounds to 0").
 */
export function MomentumLabel({ momentum }: { momentum: number | null }) {
  if (momentum == null) return null;
  const rounded = Math.round(momentum * 10) / 10;
  if (rounded === 0) return null;
  const color = rounded > 0 ? '#3ECF6B' : '#F2544C';
  const sign = rounded > 0 ? '+' : '';
  return <Text style={[styles.momentum, { color }]}>{sign}{rounded.toFixed(1)}</Text>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 4,
  },
  pill: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: {
    fontWeight: '800',
    color: '#0B0B0D',
  },
  empty: {
    fontSize: 11,
    fontWeight: '600',
    color: baseColors.textTertiary,
  },
  momentum: {
    fontSize: 13,
    fontWeight: '800',
  },
});
