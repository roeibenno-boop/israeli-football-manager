import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ClubCrest } from '@/components/ClubCrest';
import { FormGuide, MomentumLabel } from '@/components/FormGuide';
import { OverallBadge } from '@/components/OverallBadge';
import { useAuth } from '@/lib/auth-context';
import type { FormationKey } from '@/lib/formations';
import { computeClubRating, startingXIFrom, type SlotAssignment } from '@/lib/lineup';
import { buildClubMatchInputs } from '@/lib/play-match';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/lib/use-profile';
import { baseColors, radius, spacing, typography } from '@/theme';
import type { Club, Fixture, Player } from '@/types';

/**
 * Pre-match preview: both crests, both effective XI ratings, both form
 * guides, both momentum modifiers -- enough to judge the match without
 * being handed the odds. The Davidson model's actual output
 * (computeOutcomeProbabilities) never appears in this UI, or anywhere
 * else in the app -- see matchOdds.ts's file header.
 */
export default function PreMatchScreen() {
  const { fixtureId } = useLocalSearchParams<{ fixtureId: string }>();
  const { session } = useAuth();
  const { profile } = useProfile(session);
  const managedClubId = profile?.managed_club_id ?? null;

  const [fixture, setFixture] = useState<Fixture | null>(null);
  const [homeClub, setHomeClub] = useState<Club | null>(null);
  const [awayClub, setAwayClub] = useState<Club | null>(null);
  const [homeRating, setHomeRating] = useState<number | null>(null);
  const [awayRating, setAwayRating] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fixtureId) return;
    let cancelled = false;

    (async () => {
      const { data: fixtureRow, error: fixtureError } = await supabase
        .from('fixtures')
        .select('*')
        .eq('id', fixtureId)
        .single();
      if (cancelled) return;
      if (fixtureError || !fixtureRow) {
        setError(fixtureError?.message ?? 'Fixture not found.');
        setLoading(false);
        return;
      }
      setFixture(fixtureRow);

      const [homeClubRes, awayClubRes] = await Promise.all([
        supabase.from('clubs').select('*').eq('id', fixtureRow.home_club_id).single(),
        supabase.from('clubs').select('*').eq('id', fixtureRow.away_club_id).single(),
      ]);
      if (cancelled) return;
      setHomeClub(homeClubRes.data);
      setAwayClub(awayClubRes.data);

      const [homePlayersRes, awayPlayersRes] = await Promise.all([
        supabase.from('players').select('*').eq('club_id', fixtureRow.home_club_id),
        supabase.from('players').select('*').eq('club_id', fixtureRow.away_club_id),
      ]);
      if (cancelled) return;

      let userLineup: { formation: FormationKey; assignment: SlotAssignment } | undefined;
      if (session && managedClubId && (fixtureRow.home_club_id === managedClubId || fixtureRow.away_club_id === managedClubId)) {
        const { data: lineupRows } = await supabase
          .from('lineups')
          .select('id, formation')
          .eq('profile_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(1);
        if (lineupRows && lineupRows.length > 0) {
          const { data: slotRows } = await supabase
            .from('lineup_slots')
            .select('slot_key, player_id')
            .eq('lineup_id', lineupRows[0].id);
          if (slotRows && slotRows.length > 0) {
            const assignment: SlotAssignment = {};
            for (const row of slotRows) assignment[row.slot_key] = row.player_id;
            userLineup = { formation: lineupRows[0].formation as FormationKey, assignment };
          }
        }
      }

      const ratingFor = (players: Player[] | null, isManagedClub: boolean) => {
        const squad = players ?? [];
        const inputs = buildClubMatchInputs(squad, isManagedClub ? userLineup : undefined);
        const playersById = new Map(squad.map((p) => [p.id, p]));
        const xi = startingXIFrom(inputs.formation, inputs.assignment, playersById);
        return xi ? computeClubRating(xi).overall : null;
      };

      setHomeRating(ratingFor(homePlayersRes.data, fixtureRow.home_club_id === managedClubId));
      setAwayRating(ratingFor(awayPlayersRes.data, fixtureRow.away_club_id === managedClubId));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [fixtureId, session, managedClubId]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
          <Text style={styles.eyebrow}>
            {fixture ? `Round ${fixture.round}` : 'Pre-Match'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {loading && <ActivityIndicator style={styles.spinner} color={baseColors.textSecondary} />}
        {error && <Text style={styles.error}>{error}</Text>}

        {!loading && !error && (
          <View style={styles.matchup}>
            <ClubPreviewCard club={homeClub} rating={homeRating} />
            <Text style={styles.vs}>VS</Text>
            <ClubPreviewCard club={awayClub} rating={awayRating} />
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

function ClubPreviewCard({ club, rating }: { club: Club | null; rating: number | null }) {
  return (
    <View style={styles.card}>
      <ClubCrest
        primaryColour={club?.primary_colour}
        secondaryColour={club?.secondary_colour}
        initials={club?.crest_initials}
        logoUrl={club?.logo_url}
        fallbackName={club?.short_name}
        size="lg"
      />
      <Text style={styles.clubName} numberOfLines={2}>
        {club?.name ?? '—'}
      </Text>
      <View style={styles.ratingRow}>
        <OverallBadge overall={rating} size="lg" />
        <MomentumLabel momentum={club?.momentum ?? null} />
      </View>
      <FormGuide formString={club?.form_string ?? null} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: baseColors.background,
  },
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  closeText: {
    ...typography.body,
    color: baseColors.textSecondary,
    width: 40,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: baseColors.textTertiary,
  },
  spinner: {
    marginTop: spacing.xxl,
  },
  error: {
    ...typography.body,
    color: '#F2544C',
    textAlign: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  matchup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  vs: {
    ...typography.eyebrow,
    color: baseColors.textTertiary,
  },
  card: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: baseColors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: baseColors.border,
    padding: spacing.lg,
  },
  clubName: {
    ...typography.title,
    color: baseColors.textPrimary,
    textAlign: 'center',
  },
  ratingRow: {
    alignItems: 'center',
    gap: 2,
  },
});
