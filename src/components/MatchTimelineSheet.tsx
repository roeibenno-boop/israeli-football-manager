import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ClubCrest } from '@/components/ClubCrest';
import type { MatchEvent } from '@/lib/simulation';
import { baseColors, radius, spacing, typography } from '@/theme';
import type { Club, Fixture } from '@/types';

type MatchTimelineSheetProps = {
  fixture: (Omit<Fixture, 'events'> & { events: MatchEvent[] | null }) | null;
  homeClub: Club | undefined;
  awayClub: Club | undefined;
  onClose: () => void;
};

const EVENT_ICON: Record<MatchEvent['type'], string> = {
  goal: '⚽',
  yellow_card: '🟨',
  red_card: '🟥',
};

export function MatchTimelineSheet({ fixture, homeClub, awayClub, onClose }: MatchTimelineSheetProps) {
  const visible = fixture != null;
  const events = fixture?.events ?? [];

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View entering={FadeIn.duration(150)} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      </Animated.View>

      {fixture && (
        <Animated.View entering={SlideInDown.duration(250)} exiting={SlideOutDown.duration(200)} style={styles.sheet}>
          <SafeAreaView edges={['bottom']}>
            <View style={styles.handle} />

            <View style={styles.scoreRow}>
              <View style={styles.teamBlock}>
                <ClubCrest
                  primaryColour={homeClub?.primary_colour}
                  secondaryColour={homeClub?.secondary_colour}
                  initials={homeClub?.crest_initials}
                  logoUrl={homeClub?.logo_url}
                  fallbackName={homeClub?.short_name}
                  size="md"
                />
                <Text style={styles.teamName} numberOfLines={2}>
                  {homeClub?.name ?? '—'}
                </Text>
              </View>
              <Text style={styles.score}>
                {fixture.home_goals ?? '-'} : {fixture.away_goals ?? '-'}
              </Text>
              <View style={styles.teamBlock}>
                <ClubCrest
                  primaryColour={awayClub?.primary_colour}
                  secondaryColour={awayClub?.secondary_colour}
                  initials={awayClub?.crest_initials}
                  logoUrl={awayClub?.logo_url}
                  fallbackName={awayClub?.short_name}
                  size="md"
                />
                <Text style={styles.teamName} numberOfLines={2}>
                  {awayClub?.name ?? '—'}
                </Text>
              </View>
            </View>

            {events.length === 0 ? (
              <Text style={styles.empty}>No events recorded for this match.</Text>
            ) : (
              <View style={styles.timeline}>
                {events.map((event, index) => (
                  <View key={index} style={styles.eventRow}>
                    <Text style={styles.eventMinute}>{event.minute}&apos;</Text>
                    <Text style={styles.eventIcon}>{EVENT_ICON[event.type]}</Text>
                    <Text style={styles.eventText} numberOfLines={1}>
                      {event.playerName}
                    </Text>
                    <Text style={styles.eventTeam}>{event.team === 'home' ? homeClub?.short_name : awayClub?.short_name}</Text>
                  </View>
                ))}
              </View>
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
    maxHeight: '80%',
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
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  teamBlock: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  teamName: {
    ...typography.caption,
    color: baseColors.textPrimary,
    textAlign: 'center',
  },
  score: {
    ...typography.numericXL,
    color: baseColors.textPrimary,
  },
  empty: {
    ...typography.body,
    color: baseColors.textSecondary,
    textAlign: 'center',
    paddingBottom: spacing.xl,
  },
  timeline: {
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: baseColors.surfaceElevated,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  eventMinute: {
    ...typography.caption,
    color: baseColors.textTertiary,
    width: 32,
  },
  eventIcon: {
    fontSize: 14,
  },
  eventText: {
    ...typography.body,
    color: baseColors.textPrimary,
    flex: 1,
  },
  eventTeam: {
    ...typography.caption,
    color: baseColors.textTertiary,
  },
});
