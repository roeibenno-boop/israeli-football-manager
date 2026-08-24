import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { baseColors, radius, spacing, typography } from '@/theme';
import type { Club, Fixture, PlayerMatchStat } from '@/types';

type LogRow = { stat: PlayerMatchStat; fixture: Fixture; opponent: Club | undefined; wasHome: boolean };

type PlayerMatchLogSheetProps = {
  playerName: string | null;
  rows: LogRow[];
  onClose: () => void;
};

/** Match-by-match season log for one player — tapped from the performance screen. */
export function PlayerMatchLogSheet({ playerName, rows, onClose }: PlayerMatchLogSheetProps) {
  const visible = playerName != null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View entering={FadeIn.duration(150)} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      </Animated.View>

      {visible && (
        <Animated.View entering={SlideInDown.duration(250)} exiting={SlideOutDown.duration(200)} style={styles.sheet}>
          <SafeAreaView edges={['bottom']} style={styles.safeArea}>
            <View style={styles.handle} />
            <Text style={styles.title}>{playerName}</Text>
            <Text style={styles.subtitle}>Season match log</Text>

            {rows.length === 0 ? (
              <Text style={styles.empty}>No matches played yet.</Text>
            ) : (
              <ScrollView contentContainerStyle={styles.list}>
                {rows.map(({ stat, fixture, opponent, wasHome }) => (
                  <View key={stat.id} style={styles.row}>
                    <View style={styles.rowLeft}>
                      <Text style={styles.opponent} numberOfLines={1}>
                        {wasHome ? 'vs' : '@'} {opponent?.short_name ?? '—'}
                      </Text>
                      <Text style={styles.round}>Round {fixture.round}</Text>
                    </View>
                    <View style={styles.rowStats}>
                      {stat.goals > 0 && <Text style={styles.statChip}>⚽ {stat.goals}</Text>}
                      {stat.assists > 0 && <Text style={styles.statChip}>🅰️ {stat.assists}</Text>}
                      {stat.yellow_cards > 0 && <Text style={styles.statChip}>🟨</Text>}
                      {stat.red_cards > 0 && <Text style={styles.statChip}>🟥</Text>}
                      {stat.motm && <Text style={styles.statChip}>⭐</Text>}
                    </View>
                    <Text style={styles.rating}>{stat.match_rating?.toFixed(1) ?? '—'}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
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
    maxHeight: '75%',
    backgroundColor: baseColors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: baseColors.border,
    borderBottomWidth: 0,
  },
  safeArea: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: baseColors.borderStrong,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.displayLG,
    color: baseColors.textPrimary,
  },
  subtitle: {
    ...typography.eyebrow,
    color: baseColors.textTertiary,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  empty: {
    ...typography.body,
    color: baseColors.textSecondary,
    paddingBottom: spacing.xl,
  },
  list: {
    gap: spacing.xs,
    paddingBottom: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: baseColors.surfaceElevated,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  rowLeft: {
    flex: 1,
  },
  opponent: {
    ...typography.bodyBold,
    color: baseColors.textPrimary,
  },
  round: {
    ...typography.caption,
    color: baseColors.textTertiary,
  },
  rowStats: {
    flexDirection: 'row',
    gap: 4,
  },
  statChip: {
    fontSize: 12,
  },
  rating: {
    ...typography.numericMD,
    color: baseColors.textPrimary,
    width: 34,
    textAlign: 'right',
  },
});
