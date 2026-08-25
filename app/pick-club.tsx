import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ClubCrest } from '@/components/ClubCrest';
import { OverallBadge } from '@/components/OverallBadge';
import { PressableScale } from '@/components/PressableScale';
import { useAuth } from '@/lib/auth-context';
import { estimateSquadRating, type RatedPlayer } from '@/lib/ratings';
import { latestSeasonNumber, startNewSeason } from '@/lib/season-actions';
import { supabase } from '@/lib/supabase';
import { baseColors, radius, spacing, typography } from '@/theme';
import { useProfile } from '@/lib/use-profile';
import type { Club } from '@/types';

/**
 * `mode` distinguishes the three ways a manager can land here, since each
 * needs different season-lifecycle handling (src/lib/season-actions.ts):
 * - undefined (no prior seasons) -- first-ever club claim: season 1, no aging.
 * - undefined (prior seasons exist) -- the pre-existing mid-season "Switch
 *   Club" escape hatch (Squad tab): season_number+1, but NOT a real
 *   rollover, so no aging either.
 * - 'new-season' -- "Manage a different club" from the season summary
 *   screen, after a season genuinely completed: season_number+1, WITH aging.
 * - 'restart' -- Settings' "Restart Season": always season 1, no aging (a
 *   restart is a do-over of the current season, not a season passing).
 */
type ClaimMode = 'new-season' | 'restart' | undefined;

export default function PickClubScreen() {
  const { session, loading: sessionLoading } = useAuth();
  const { profile, loading: profileLoading, refresh } = useProfile(session);
  const { mode } = useLocalSearchParams<{ mode?: ClaimMode }>();

  const [clubs, setClubs] = useState<Club[]>([]);
  const [ratingsByClub, setRatingsByClub] = useState<Record<string, number | null>>({});
  const [loadingClubs, setLoadingClubs] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      supabase.from('clubs').select('*').order('name', { ascending: true }),
      supabase.from('players').select('club_id, position, overall'),
    ]).then(([clubsRes, playersRes]) => {
      if (cancelled) return;

      if (clubsRes.error) {
        setError(clubsRes.error.message);
        setLoadingClubs(false);
        return;
      }
      setClubs(clubsRes.data ?? []);

      const byClub: Record<string, RatedPlayer[]> = {};
      for (const p of playersRes.data ?? []) {
        if (p.overall == null) continue;
        (byClub[p.club_id] ??= []).push({ position: p.position, overall: p.overall });
      }
      const ratings: Record<string, number | null> = {};
      for (const club of clubsRes.data ?? []) {
        // Prefer the persisted rating (set when a manager saves a lineup);
        // most clubs never get one (nobody manages them), so fall back to
        // a rough estimate from the full squad.
        if (club.current_rating != null) {
          ratings[club.id] = club.current_rating;
          continue;
        }
        const squad = byClub[club.id];
        ratings[club.id] = squad && squad.length > 0 ? estimateSquadRating(squad).overall : null;
      }
      setRatingsByClub(ratings);
      setLoadingClubs(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!sessionLoading && !session) {
    return <Redirect href="/sign-in" />;
  }
  if (!profileLoading && profile?.managed_club_id) {
    return <Redirect href="/" />;
  }

  const claim = async (club: Club) => {
    if (!session) return;
    setClaimingId(club.id);
    setError(null);

    try {
      const seasonNumber = mode === 'restart' ? 1 : (await latestSeasonNumber(session.user.id)) + 1;
      await startNewSeason({
        profileId: session.user.id,
        clubId: club.id,
        seasonNumber,
        age: mode === 'new-season',
      });
      await refresh();
      router.replace('/');
    } catch (e) {
      setClaimingId(null);
      setError(e instanceof Error ? e.message : 'Failed to claim this club.');
    }
  };

  const busy = sessionLoading || profileLoading || loadingClubs;

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Text style={styles.eyebrow}>Israeli Football Manager</Text>
        <Text style={styles.title}>Choose Your Club</Text>
        <Text style={styles.subtitle}>
          {mode === 'restart'
            ? 'Pick a club to start your new season with — a genuinely clean slate.'
            : 'Every club here is currently unmanaged — pick one to take charge.'}
        </Text>

        {busy && <ActivityIndicator style={styles.spinner} color={baseColors.textSecondary} />}
        {error && <Text style={styles.error}>{error}</Text>}

        <FlatList
          data={clubs}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => (
            <ClubCard
              club={item}
              overall={ratingsByClub[item.id] ?? null}
              index={index}
              claiming={claimingId === item.id}
              disabled={claimingId !== null}
              onPress={() => claim(item)}
            />
          )}
        />
      </SafeAreaView>
    </View>
  );
}

type ClubCardProps = {
  club: Club;
  overall: number | null;
  index: number;
  claiming: boolean;
  disabled: boolean;
  onPress: () => void;
};

function ClubCard({ club, overall, index, claiming, disabled, onPress }: ClubCardProps) {
  return (
    <Animated.View entering={FadeInDown.duration(300).delay(Math.min(index, 10) * 40)} style={styles.cardWrapper}>
      <PressableScale
        style={[styles.card, disabled && !claiming && styles.cardDisabled]}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`Manage ${club.name}`}>
        <ClubCrest
          primaryColour={club.primary_colour}
          secondaryColour={club.secondary_colour}
          initials={club.crest_initials}
          logoUrl={club.logo_url}
          fallbackName={club.short_name}
          size="lg"
        />
        <Text style={styles.cardName} numberOfLines={2}>
          {club.name}
        </Text>
        <View style={styles.cardFooter}>
          <Text style={styles.cardLeague} numberOfLines={1}>
            {club.league}
          </Text>
          <OverallBadge overall={overall} size="sm" />
        </View>
        {claiming && (
          <View style={styles.claimingOverlay}>
            <ActivityIndicator color={baseColors.textPrimary} />
            <Text style={styles.claimingText}>Setting up your season…</Text>
          </View>
        )}
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: baseColors.background,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.xs,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: baseColors.textTertiary,
  },
  title: {
    ...typography.displayXL,
    color: baseColors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: baseColors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  spinner: {
    marginVertical: spacing.lg,
  },
  error: {
    ...typography.body,
    color: '#F2544C',
    marginBottom: spacing.md,
  },
  row: {
    gap: spacing.md,
  },
  listContent: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  cardWrapper: {
    flex: 1,
  },
  card: {
    flex: 1,
    backgroundColor: baseColors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: baseColors.border,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    overflow: 'hidden',
  },
  cardDisabled: {
    opacity: 0.4,
  },
  cardName: {
    ...typography.title,
    color: baseColors.textPrimary,
    textAlign: 'center',
    minHeight: 44,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
  },
  cardLeague: {
    ...typography.caption,
    color: baseColors.textTertiary,
    flex: 1,
  },
  claimingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(11,11,13,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  claimingText: {
    ...typography.caption,
    color: baseColors.textSecondary,
  },
});

// Kept separate from theme/colors.ts: this is a one-off UI-only error red,
// not a semantic token used elsewhere yet.
const positionErrorColor = '#F2544C';
