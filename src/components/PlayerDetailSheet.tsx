import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OverallBadge } from '@/components/OverallBadge';
import { PositionPill } from '@/components/PositionPill';
import { StatBar } from '@/components/StatBar';
import { baseColors, radius, spacing, typography, useClubTheme } from '@/theme';
import type { Player } from '@/types';

type PlayerDetailSheetProps = {
  player: Player | null;
  onClose: () => void;
};

function formatMarketValue(value: number): string {
  if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `€${Math.round(value / 1000)}K`;
  return `€${value}`;
}

function formatContract(contractUntil: string | null): string {
  if (!contractUntil) return 'Unknown';
  return new Date(contractUntil).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

const ATTRIBUTES: Array<{ key: keyof Player; label: string }> = [
  { key: 'pace', label: 'Pace' },
  { key: 'shooting', label: 'Shooting' },
  { key: 'passing', label: 'Passing' },
  { key: 'dribbling', label: 'Dribbling' },
  { key: 'defending', label: 'Defending' },
  { key: 'physical', label: 'Physical' },
];

/** Bottom sheet with the six attribute bars, potential, contract, and nationality. */
export function PlayerDetailSheet({ player, onClose }: PlayerDetailSheetProps) {
  const theme = useClubTheme();

  return (
    <Modal visible={player != null} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View entering={FadeIn.duration(150)} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      </Animated.View>

      {player && (
        <Animated.View
          entering={SlideInDown.duration(250)}
          exiting={SlideOutDown.duration(200)}
          style={styles.sheet}>
          <SafeAreaView edges={['bottom']}>
            <View style={styles.handle} />

            <View style={styles.header}>
              <OverallBadge overall={player.overall} size="lg" />
              <View style={styles.headerText}>
                <Text style={styles.name} numberOfLines={2}>
                  {player.full_name}
                </Text>
                <View style={styles.headerMeta}>
                  <PositionPill position={player.position} />
                  <Text style={styles.metaText}>
                    {player.nationality} · Age {player.age ?? '—'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.factsRow}>
              <View style={styles.fact}>
                <Text style={styles.factLabel}>Potential</Text>
                <Text style={[styles.factValue, { color: theme.accent }]}>{player.potential ?? '—'}</Text>
              </View>
              <View style={styles.fact}>
                <Text style={styles.factLabel}>Market Value</Text>
                <Text style={styles.factValue}>{formatMarketValue(player.market_value)}</Text>
              </View>
              <View style={styles.fact}>
                <Text style={styles.factLabel}>Contract Until</Text>
                <Text style={styles.factValue}>{formatContract(player.contract_until)}</Text>
              </View>
            </View>

            <View style={styles.attributes}>
              {ATTRIBUTES.map(({ key, label }) => (
                <StatBar key={key} label={label} value={player[key] as number | null} color={theme.accent} />
              ))}
            </View>
          </SafeAreaView>
        </Animated.View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: baseColors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderWidth: 1,
    borderColor: baseColors.border,
    borderBottomWidth: 0,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: baseColors.borderStrong,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
  },
  name: {
    ...typography.displayLG,
    color: baseColors.textPrimary,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  metaText: {
    ...typography.caption,
    color: baseColors.textSecondary,
  },
  factsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: baseColors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  fact: {
    alignItems: 'center',
    gap: 2,
  },
  factLabel: {
    ...typography.eyebrow,
    color: baseColors.textTertiary,
  },
  factValue: {
    ...typography.numericMD,
    color: baseColors.textPrimary,
  },
  attributes: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
});
