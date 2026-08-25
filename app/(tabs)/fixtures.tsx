import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ClubCrest } from '@/components/ClubCrest';
import { MatchTimelineSheet } from '@/components/MatchTimelineSheet';
import { PressableScale } from '@/components/PressableScale';
import { useAuth } from '@/lib/auth-context';
import type { FormationKey } from '@/lib/formations';
import type { SlotAssignment } from '@/lib/lineup';
import { buildClubMatchInputs, processFixture, type MatchStatRow, type PlayerConditionUpdate } from '@/lib/play-match';
import type { MatchEvent } from '@/lib/simulation';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/lib/use-profile';
import { baseColors, radius, spacing, typography, useClubTheme } from '@/theme';
import type { Club, Fixture, Player } from '@/types';

type Section = { round: number; data: Fixture[] };

function formatKickoff(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function FixturesScreen() {
  const { session } = useAuth();
  const { profile } = useProfile(session);
  const theme = useClubTheme();

  const [clubs, setClubs] = useState<Club[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);
  const [selectedFixture, setSelectedFixture] = useState<Fixture | null>(null);

  const managedClubId = profile?.managed_club_id ?? null;
  const seasonId = profile?.current_season_id ?? null;

  const load = useCallback(async () => {
    if (!seasonId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [clubsRes, fixturesRes] = await Promise.all([
      supabase.from('clubs').select('*'),
      supabase
        .from('fixtures')
        .select('*')
        .eq('competition', 'league')
        .eq('season_id', seasonId)
        .order('round', { ascending: true })
        .order('kickoff_at', { ascending: true }),
    ]);
    if (clubsRes.error) setError(clubsRes.error.message);
    else setClubs(clubsRes.data ?? []);
    if (fixturesRes.error) setError(fixturesRes.error.message);
    else setError(null);
    setFixtures(fixturesRes.data ?? []);
    setLoading(false);
  }, [seasonId]);

  // Refetches on every focus, not just first mount -- same reasoning as
  // the other tabs (Expo Router keeps them mounted). Matters here too:
  // e.g. after saving a lineup elsewhere, revisiting Fixtures should still
  // show a consistent picture.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const clubsById = useMemo(() => new Map(clubs.map((c) => [c.id, c])), [clubs]);

  const sections = useMemo<Section[]>(() => {
    const byRound = new Map<number, Fixture[]>();
    for (const fixture of fixtures) {
      (byRound.get(fixture.round) ?? byRound.set(fixture.round, []).get(fixture.round)!).push(fixture);
    }
    return [...byRound.entries()].sort((a, b) => a[0] - b[0]).map(([round, data]) => ({ round, data }));
  }, [fixtures]);

  const playNextMatch = async () => {
    if (!managedClubId) return;
    setPlaying(true);
    setPlayError(null);

    try {
      const nextFixture = fixtures
        .filter((f) => f.status === 'scheduled' && (f.home_club_id === managedClubId || f.away_club_id === managedClubId))
        .sort((a, b) => a.round - b.round)[0];

      if (!nextFixture) {
        setPlayError('No more fixtures to play this season.');
        return;
      }

      const roundFixtures = fixtures.filter((f) => f.round === nextFixture.round && f.status === 'scheduled');
      const clubIdsInRound = new Set<string>();
      roundFixtures.forEach((f) => {
        clubIdsInRound.add(f.home_club_id);
        clubIdsInRound.add(f.away_club_id);
      });

      const { data: roundPlayers, error: playersError } = await supabase
        .from('players')
        .select('*')
        .in('club_id', [...clubIdsInRound]);
      if (playersError) throw playersError;

      const playersById = new Map((roundPlayers ?? []).map((p) => [p.id, p]));
      const playersByClub = new Map<string, Player[]>();
      for (const p of roundPlayers ?? []) {
        (playersByClub.get(p.club_id) ?? playersByClub.set(p.club_id, []).get(p.club_id)!).push(p);
      }

      let userLineup: { formation: FormationKey; assignment: SlotAssignment } | undefined;
      if (session) {
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

      // Season-to-date yellow counts, for the 5-yellows-is-a-ban rule --
      // fetched once for everyone in the round rather than per-fixture.
      const { data: priorStats, error: priorStatsError } = await supabase
        .from('player_match_stats')
        .select('player_id, yellow_cards')
        .in('player_id', [...playersById.keys()]);
      if (priorStatsError) throw priorStatsError;
      const priorSeasonYellows = new Map<string, number>();
      for (const row of priorStats ?? []) {
        priorSeasonYellows.set(row.player_id, (priorSeasonYellows.get(row.player_id) ?? 0) + row.yellow_cards);
      }

      // Matches each club has already played this season -- computed from
      // the fixtures already loaded, no extra query needed.
      const matchesPlayedByClub = (clubId: string) =>
        fixtures.filter(
          (f) => f.status === 'finished' && (f.home_club_id === clubId || f.away_club_id === clubId)
        ).length;

      const allStatRows: MatchStatRow[] = [];
      const allPlayerUpdates: PlayerConditionUpdate[] = [];
      const clubRatingUpdates = new Map<string, number>();
      const clubFormUpdates = new Map<string, { form_string: string; momentum: number }>();

      for (const fixture of roundFixtures) {
        const homeInputs = buildClubMatchInputs(
          playersByClub.get(fixture.home_club_id) ?? [],
          fixture.home_club_id === managedClubId ? userLineup : undefined
        );
        const awayInputs = buildClubMatchInputs(
          playersByClub.get(fixture.away_club_id) ?? [],
          fixture.away_club_id === managedClubId ? userLineup : undefined
        );

        const homeClub = clubsById.get(fixture.home_club_id);
        const awayClub = clubsById.get(fixture.away_club_id);

        const result = processFixture({
          fixtureId: fixture.id,
          homeClubId: fixture.home_club_id,
          awayClubId: fixture.away_club_id,
          home: homeInputs,
          away: awayInputs,
          homeFullSquad: playersByClub.get(fixture.home_club_id) ?? [],
          awayFullSquad: playersByClub.get(fixture.away_club_id) ?? [],
          restDays: 7,
          priorSeasonYellows,
          homeFormBefore: { form_string: homeClub?.form_string ?? '', momentum: homeClub?.momentum ?? 0 },
          awayFormBefore: { form_string: awayClub?.form_string ?? '', momentum: awayClub?.momentum ?? 0 },
          homeMatchesPlayedBefore: matchesPlayedByClub(fixture.home_club_id),
          awayMatchesPlayedBefore: matchesPlayedByClub(fixture.away_club_id),
        });

        allStatRows.push(...result.statRows);
        allPlayerUpdates.push(...result.playerUpdates);
        clubRatingUpdates.set(fixture.home_club_id, result.homeClubRating);
        clubRatingUpdates.set(fixture.away_club_id, result.awayClubRating);
        clubFormUpdates.set(fixture.home_club_id, result.homeForm);
        clubFormUpdates.set(fixture.away_club_id, result.awayForm);

        const { error: fixtureUpdateError } = await supabase
          .from('fixtures')
          .update({
            home_goals: result.homeGoals,
            away_goals: result.awayGoals,
            events: result.events,
            attendance: result.attendance,
            status: 'finished',
          })
          .eq('id', fixture.id);
        if (fixtureUpdateError) throw fixtureUpdateError;
      }

      // Not a single transaction (Supabase's client API has no cross-table
      // transaction primitive -- see play-match.ts's header comment).
      // player_match_stats' unique(fixture_id, player_id) at least stops a
      // retry from double-writing stats if something below fails.
      const { error: statsError } = await supabase.from('player_match_stats').insert(
        allStatRows.map((row) => ({
          fixture_id: row.fixture_id,
          season_id: seasonId,
          player_id: row.playerId,
          club_id: row.club_id,
          minutes_played: row.minutesPlayed,
          started: row.started,
          goals: row.goals,
          assists: row.assists,
          shots: row.shots,
          shots_on_target: row.shotsOnTarget,
          key_passes: row.keyPasses,
          passes_attempted: row.passesAttempted,
          passes_completed: row.passesCompleted,
          tackles: row.tackles,
          interceptions: row.interceptions,
          duels_won: row.duelsWon,
          duels_lost: row.duelsLost,
          saves: row.saves,
          goals_conceded: row.goalsConceded,
          clean_sheet: row.cleanSheet,
          yellow_cards: row.yellowCards,
          red_cards: row.redCards,
          own_goals: row.ownGoals,
          penalties_scored: row.penaltiesScored,
          penalties_missed: row.penaltiesMissed,
          match_rating: row.match_rating,
          motm: row.motm,
        }))
      );
      if (statsError) throw statsError;

      const chunk = <T,>(items: T[], size: number): T[][] => {
        const out: T[][] = [];
        for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
        return out;
      };

      for (const batch of chunk(allPlayerUpdates, 20)) {
        await Promise.all(
          batch.map((update) =>
            supabase
              .from('players')
              .update({
                fatigue_points: update.fatigue_points,
                fatigue_level: update.fatigue_level,
                injured_until: update.injured_until,
                suspended_matches: update.suspended_matches,
                form: update.form,
                season_goals: update.season_goals,
                season_assists: update.season_assists,
                season_apps: update.season_apps,
                season_minutes: update.season_minutes,
              })
              .eq('id', update.playerId)
          )
        );
      }

      await Promise.all(
        [...clubRatingUpdates.entries()].map(([clubId, rating]) => {
          const form = clubFormUpdates.get(clubId);
          return supabase
            .from('clubs')
            .update({
              current_rating: rating,
              ...(form ? { form_string: form.form_string, momentum: form.momentum } : {}),
            })
            .eq('id', clubId);
        })
      );

      // If this was the last round with any scheduled fixtures left, the
      // season just finished -- hand off to the summary screen instead of
      // just reloading in place. That screen is the ONLY place the
      // continue/switch-club offer appears (see its own header comment).
      const seasonNowOver = fixtures.every((f) => f.round === nextFixture.round || f.status !== 'scheduled');
      if (seasonNowOver) {
        router.push('/season-summary');
      } else {
        await load();
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to play the round.';
      setPlayError(
        message.includes('does not exist') || message.includes('schema cache') || message.includes('permission denied')
          ? "Can't play matches yet — run migration 0007 first."
          : message
      );
    } finally {
      setPlaying(false);
    }
  };

  const hasNextMatch = fixtures.some(
    (f) => f.status === 'scheduled' && (f.home_club_id === managedClubId || f.away_club_id === managedClubId)
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Ligat ha&apos;Al</Text>
          <Text style={styles.title}>Fixtures</Text>
        </View>

        <View style={styles.playRow}>
          <PressableScale
            style={[styles.playButton, { backgroundColor: theme.accent }, (!hasNextMatch || playing) && styles.playButtonDisabled]}
            onPress={playNextMatch}
            disabled={!hasNextMatch || playing}>
            {playing ? (
              <ActivityIndicator color={baseColors.textInverse} />
            ) : (
              <Text style={styles.playButtonText}>
                {hasNextMatch ? 'Play Next Match' : 'Season Complete'}
              </Text>
            )}
          </PressableScale>
          {playError && <Text style={styles.error}>{playError}</Text>}
        </View>

        {loading && <ActivityIndicator style={styles.spinner} color={baseColors.textSecondary} />}
        {error && <Text style={styles.error}>{error}</Text>}
        {!loading && !error && fixtures.length === 0 && (
          <Text style={styles.empty}>
            No fixtures yet — run `npm run generate-fixtures` (needs the service_role key) to schedule a season.
          </Text>
        )}

        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderSectionHeader={({ section }) => (
            <Text style={styles.roundHeader}>Round {section.round}</Text>
          )}
          renderItem={({ item }) => (
            <MatchRow
              fixture={item}
              homeClub={clubsById.get(item.home_club_id)}
              awayClub={clubsById.get(item.away_club_id)}
              highlighted={item.home_club_id === managedClubId || item.away_club_id === managedClubId}
              onPress={() =>
                item.status === 'finished'
                  ? setSelectedFixture(item)
                  : router.push({ pathname: '/match/[fixtureId]', params: { fixtureId: item.id } })
              }
            />
          )}
        />
      </SafeAreaView>

      <MatchTimelineSheet
        fixture={selectedFixture as (Fixture & { events: MatchEvent[] | null }) | null}
        homeClub={selectedFixture ? clubsById.get(selectedFixture.home_club_id) : undefined}
        awayClub={selectedFixture ? clubsById.get(selectedFixture.away_club_id) : undefined}
        onClose={() => setSelectedFixture(null)}
      />
    </View>
  );
}

function MatchRow({
  fixture,
  homeClub,
  awayClub,
  highlighted,
  onPress,
}: {
  fixture: Fixture;
  homeClub: Club | undefined;
  awayClub: Club | undefined;
  highlighted: boolean;
  onPress: () => void;
}) {
  const played = fixture.status === 'finished';
  return (
    <PressableScale style={[styles.matchRow, highlighted && styles.matchRowHighlighted]} onPress={onPress}>
      <View style={styles.matchTeam}>
        <ClubCrest
          primaryColour={homeClub?.primary_colour}
          secondaryColour={homeClub?.secondary_colour}
          initials={homeClub?.crest_initials}
          logoUrl={homeClub?.logo_url}
          fallbackName={homeClub?.short_name}
          size="sm"
        />
        <Text style={styles.matchTeamName} numberOfLines={1}>
          {homeClub?.short_name ?? '—'}
        </Text>
      </View>

      <View style={styles.matchCenter}>
        {played ? (
          <Text style={styles.matchScore}>
            {fixture.home_goals} - {fixture.away_goals}
          </Text>
        ) : (
          <Text style={styles.matchKickoff}>{formatKickoff(fixture.kickoff_at)}</Text>
        )}
      </View>

      <View style={[styles.matchTeam, styles.matchTeamAway]}>
        <Text style={styles.matchTeamName} numberOfLines={1}>
          {awayClub?.short_name ?? '—'}
        </Text>
        <ClubCrest
          primaryColour={awayClub?.primary_colour}
          secondaryColour={awayClub?.secondary_colour}
          initials={awayClub?.crest_initials}
          logoUrl={awayClub?.logo_url}
          fallbackName={awayClub?.short_name}
          size="sm"
        />
      </View>
    </PressableScale>
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
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: baseColors.textTertiary,
  },
  title: {
    ...typography.displayXL,
    color: baseColors.textPrimary,
  },
  playRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.xs,
  },
  playButton: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  playButtonDisabled: {
    opacity: 0.4,
  },
  playButtonText: {
    ...typography.bodyBold,
    color: baseColors.textInverse,
  },
  spinner: {
    marginTop: spacing.xl,
  },
  error: {
    ...typography.caption,
    color: '#F2544C',
    paddingHorizontal: spacing.lg,
  },
  empty: {
    ...typography.body,
    color: baseColors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.xs,
  },
  roundHeader: {
    ...typography.eyebrow,
    color: baseColors.textTertiary,
    backgroundColor: baseColors.background,
    paddingVertical: spacing.sm,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: baseColors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: baseColors.border,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  matchRowHighlighted: {
    borderColor: baseColors.borderStrong,
  },
  matchTeam: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  matchTeamAway: {
    justifyContent: 'flex-end',
  },
  matchTeamName: {
    ...typography.caption,
    color: baseColors.textPrimary,
    flexShrink: 1,
  },
  matchCenter: {
    paddingHorizontal: spacing.md,
    minWidth: 88,
    alignItems: 'center',
  },
  matchScore: {
    ...typography.numericMD,
    color: baseColors.textPrimary,
  },
  matchKickoff: {
    ...typography.caption,
    color: baseColors.textTertiary,
    textAlign: 'center',
  },
});
