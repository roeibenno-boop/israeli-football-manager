import { Redirect, router, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ClubCrest } from '@/components/ClubCrest';
import { PressableScale } from '@/components/PressableScale';
import { useAuth } from '@/lib/auth-context';
import { bestAverageRating, buildLeaderRows, topScorers } from '@/lib/leaders';
import { archiveSeason, setProfileSeason, startNewSeason } from '@/lib/season-actions';
import { computeStandings, type StandingsRow } from '@/lib/standings';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/lib/use-profile';
import { baseColors, radius, spacing, typography } from '@/theme';
import type { Club, Fixture, Player, PlayerMatchStat, Season } from '@/types';

/**
 * The end-of-season offer -- "Continue with <club>" or "Manage a different
 * club" -- appears here and only here, per spec: no tab/menu entry, and
 * this screen itself refuses to render the offer (redirects back to
 * Fixtures instead) unless the season it's looking at genuinely has no
 * scheduled fixtures left. That's what keeps mid-season access a no-op
 * rather than a working deep link.
 */
export default function SeasonSummaryScreen() {
  const { session } = useAuth();
  const { profile, refresh: refreshProfile } = useProfile(session);

  const [season, setSeason] = useState<Season | null>(null);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [stats, setStats] = useState<PlayerMatchStat[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState<'continue' | 'switch' | null>(null);

  const seasonId = profile?.current_season_id ?? null;

  useEffect(() => {
    if (!seasonId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    (async () => {
      const [seasonRes, clubsRes, fixturesRes] = await Promise.all([
        supabase.from('seasons').select('*').eq('id', seasonId).single(),
        supabase.from('clubs').select('*'),
        supabase.from('fixtures').select('*').eq('season_id', seasonId).eq('competition', 'league'),
      ]);
      if (cancelled) return;
      if (seasonRes.error) {
        setError(seasonRes.error.message);
        setLoading(false);
        return;
      }
      setSeason(seasonRes.data);
      setClubs(clubsRes.data ?? []);
      setFixtures(fixturesRes.data ?? []);

      const [statsRes, playersRes] = await Promise.all([
        supabase.from('player_match_stats').select('*').eq('season_id', seasonId),
        supabase.from('players').select('*'),
      ]);
      if (cancelled) return;
      setStats(statsRes.data ?? []);
      setPlayers(playersRes.data ?? []);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [seasonId]);

  const seasonOver = useMemo(
    () => fixtures.length > 0 && fixtures.every((f) => f.status !== 'scheduled'),
    [fixtures]
  );

  const standings = useMemo(() => computeStandings(fixtures, clubs), [fixtures, clubs]);
  const managedClubId = season?.club_id ?? null;
  const managedRow = useMemo<StandingsRow | null>(
    () => standings.find((r) => r.club.id === managedClubId) ?? null,
    [standings, managedClubId]
  );
  const managedPosition = useMemo(
    () => (managedRow ? standings.findIndex((r) => r.club.id === managedClubId) + 1 : null),
    [standings, managedRow, managedClubId]
  );

  const leaderRows = useMemo(() => buildLeaderRows(stats, players), [stats, players]);
  const clubsById = useMemo(() => new Map(clubs.map((c) => [c.id, c])), [clubs]);
  const playersById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const leagueTopScorer = topScorers(leaderRows, 1)[0] ?? null;
  const leaguePlayerOfSeason = bestAverageRating(leaderRows, 1)[0] ?? null;
  const ownTopScorer = topScorers(
    leaderRows.filter((r) => r.clubId === managedClubId),
    1
  )[0] ?? null;
  const ownRatingLeader = bestAverageRating(
    leaderRows.filter((r) => r.clubId === managedClubId),
    1
  )[0] ?? null;

  const managedClub = managedClubId ? clubsById.get(managedClubId) : null;

  const advance = async (path: 'continue' | 'switch') => {
    if (!session || !season) return;
    setAdvancing(path);
    setError(null);

    try {
      await archiveSeason({
        seasonId: season.id,
        finalPosition: managedPosition,
        finalPoints: managedRow?.points ?? null,
      });

      if (path === 'continue') {
        await startNewSeason({
          profileId: session.user.id,
          clubId: season.club_id,
          seasonNumber: season.season_number + 1,
          age: true,
        });
        await refreshProfile();
        router.replace('/');
      } else {
        await setProfileSeason(session.user.id, null, null);
        await refreshProfile();
        router.replace('/pick-club?mode=new-season');
      }
    } catch (e) {
      setAdvancing(null);
      setError(e instanceof Error ? e.message : 'Failed to advance to the next season.');
    }
  };

  if (!loading && !seasonOver) {
    // Reached out of order (back button, a typed-in URL) -- the offer only
    // makes sense once the season actually has no fixtures left to play.
    return <Redirect href="/(tabs)/fixtures" />;
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <SafeAreaView style={styles.safeArea}>
        {loading && <ActivityIndicator style={styles.spinner} color={baseColors.textSecondary} />}
        {error && <Text style={styles.error}>{error}</Text>}

        {!loading && season && (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text style={styles.eyebrow}>Season {season.season_number} Complete</Text>
            <View style={styles.heroRow}>
              <ClubCrest
                primaryColour={managedClub?.primary_colour}
                secondaryColour={managedClub?.secondary_colour}
                initials={managedClub?.crest_initials}
                logoUrl={managedClub?.logo_url}
                fallbackName={managedClub?.short_name}
                size="lg"
              />
              <View style={styles.heroText}>
                <Text style={styles.heroClub} numberOfLines={2}>
                  {managedClub?.name ?? '—'}
                </Text>
                <Text style={styles.heroPosition}>
                  {managedPosition ? ordinal(managedPosition) : '—'} place
                </Text>
                <Text style={styles.heroPoints}>{managedRow?.points ?? 0} points</Text>
              </View>
            </View>

            <View style={styles.statsGrid}>
              <StatCell label="Played" value={managedRow?.played ?? 0} />
              <StatCell label="Won" value={managedRow?.won ?? 0} />
              <StatCell label="Drawn" value={managedRow?.drawn ?? 0} />
              <StatCell label="Lost" value={managedRow?.lost ?? 0} />
              <StatCell label="GF" value={managedRow?.goalsFor ?? 0} />
              <StatCell label="GA" value={managedRow?.goalsAgainst ?? 0} />
            </View>

            <Text style={styles.sectionLabel}>Your Season</Text>
            <View style={styles.card}>
              <AwardRow
                label="Your top scorer"
                name={ownTopScorer?.fullName ?? null}
                value={ownTopScorer ? `${ownTopScorer.goals} goals` : null}
              />
              <AwardRow
                label="Your rating leader"
                name={ownRatingLeader?.fullName ?? null}
                value={ownRatingLeader ? ownRatingLeader.avgRating.toFixed(1) : null}
              />
            </View>

            <Text style={styles.sectionLabel}>League Awards</Text>
            <View style={styles.card}>
              <AwardRow
                label="Top Scorer"
                name={leagueTopScorer?.fullName ?? null}
                club={leagueTopScorer ? clubsById.get(leagueTopScorer.clubId)?.short_name : undefined}
                value={leagueTopScorer ? `${leagueTopScorer.goals} goals` : null}
              />
              <AwardRow
                label="Player of the Season"
                name={leaguePlayerOfSeason?.fullName ?? null}
                club={leaguePlayerOfSeason ? clubsById.get(leaguePlayerOfSeason.clubId)?.short_name : undefined}
                value={leaguePlayerOfSeason ? leaguePlayerOfSeason.avgRating.toFixed(1) : null}
              />
            </View>

            <View style={styles.actions}>
              <PressableScale
                style={styles.primaryButton}
                onPress={() => advance('continue')}
                disabled={advancing !== null}>
                {advancing === 'continue' ? (
                  <ActivityIndicator color={baseColors.textInverse} />
                ) : (
                  <Text style={styles.primaryButtonText}>Continue with {managedClub?.short_name ?? 'this club'}</Text>
                )}
              </PressableScale>
              <PressableScale
                style={styles.secondaryButton}
                onPress={() => advance('switch')}
                disabled={advancing !== null}>
                {advancing === 'switch' ? (
                  <ActivityIndicator color={baseColors.textPrimary} />
                ) : (
                  <Text style={styles.secondaryButtonText}>Manage a different club</Text>
                )}
              </PressableScale>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

function StatCell({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function AwardRow({
  label,
  name,
  club,
  value,
}: {
  label: string;
  name: string | null;
  club?: string;
  value: string | null;
}) {
  return (
    <View style={styles.awardRow}>
      <Text style={styles.awardLabel}>{label}</Text>
      <View style={styles.awardNameBlock}>
        <Text style={styles.awardName} numberOfLines={1}>
          {name ?? '—'}
          {club ? ` (${club})` : ''}
        </Text>
      </View>
      <Text style={styles.awardValue}>{value ?? '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: baseColors.background },
  safeArea: { flex: 1 },
  spinner: { marginTop: spacing.xxl },
  error: { ...typography.body, color: '#F2544C', textAlign: 'center', marginTop: spacing.xl, paddingHorizontal: spacing.lg },
  scrollContent: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  eyebrow: { ...typography.eyebrow, color: baseColors.textTertiary, textAlign: 'center' },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, justifyContent: 'center' },
  heroText: { alignItems: 'flex-start', gap: 2 },
  heroClub: { ...typography.displayLG, color: baseColors.textPrimary },
  heroPosition: { ...typography.numericLG, color: '#F2C94C' },
  heroPoints: { ...typography.body, color: baseColors.textSecondary },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: baseColors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: baseColors.border,
  },
  statCell: {
    width: '33.33%',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: 2,
  },
  statValue: { ...typography.numericLG, color: baseColors.textPrimary },
  statLabel: { ...typography.eyebrow, fontSize: 10, color: baseColors.textTertiary },
  sectionLabel: { ...typography.eyebrow, color: baseColors.textTertiary },
  card: {
    backgroundColor: baseColors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: baseColors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  awardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  awardLabel: { ...typography.caption, color: baseColors.textTertiary, width: 130 },
  awardNameBlock: { flex: 1 },
  awardName: { ...typography.bodyBold, color: baseColors.textPrimary },
  awardValue: { ...typography.numericMD, color: baseColors.textPrimary },
  actions: { gap: spacing.sm, marginTop: spacing.md },
  primaryButton: {
    backgroundColor: '#3ECF6B',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryButtonText: { ...typography.bodyBold, color: baseColors.textInverse },
  secondaryButton: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: baseColors.borderStrong,
  },
  secondaryButtonText: { ...typography.bodyBold, color: baseColors.textPrimary },
});
