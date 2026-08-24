import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FatigueDot } from '@/components/FatigueDot';
import { OverallBadge } from '@/components/OverallBadge';
import { PlayerMatchLogSheet } from '@/components/PlayerMatchLogSheet';
import { PressableScale } from '@/components/PressableScale';
import { useAuth } from '@/lib/auth-context';
import { buildLeaderRows, type LeaderRow } from '@/lib/leaders';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/lib/use-profile';
import { baseColors, radius, spacing, typography, useClubTheme } from '@/theme';
import type { Club, Fixture, Player, PlayerMatchStat } from '@/types';

type SortKey = 'apps' | 'minutes' | 'goals' | 'assists' | 'rating' | 'motm' | 'yellows' | 'reds';
const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'apps', label: 'Apps' },
  { key: 'minutes', label: 'Mins' },
  { key: 'goals', label: 'Goals' },
  { key: 'assists', label: 'Assists' },
  { key: 'rating', label: 'Rating' },
  { key: 'motm', label: 'MOTM' },
  { key: 'yellows', label: 'Yellows' },
  { key: 'reds', label: 'Reds' },
];

function sortValue(row: LeaderRow, key: SortKey): number {
  switch (key) {
    case 'apps':
      return row.apps;
    case 'minutes':
      return row.minutes;
    case 'goals':
      return row.goals;
    case 'assists':
      return row.assists;
    case 'rating':
      return row.avgRating;
    case 'motm':
      return row.motm;
    case 'yellows':
      return row.yellowCards;
    case 'reds':
      return row.redCards;
  }
}

function isInjured(player: Player): boolean {
  if (!player.injured_until) return false;
  return player.injured_until >= new Date().toISOString().slice(0, 10);
}

export default function PerformanceScreen() {
  const { session } = useAuth();
  const { profile } = useProfile(session);
  const theme = useClubTheme();

  const [players, setPlayers] = useState<Player[]>([]);
  const [stats, setStats] = useState<PlayerMatchStat[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [opponentsById, setOpponentsById] = useState<Map<string, Club>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('rating');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  const managedClubId = profile?.managed_club_id ?? null;

  useEffect(() => {
    if (!managedClubId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    (async () => {
      const { data: squad, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('club_id', managedClubId);
      if (cancelled) return;
      if (playersError) {
        setError(playersError.message);
        setLoading(false);
        return;
      }
      setPlayers(squad ?? []);

      const playerIds = (squad ?? []).map((p) => p.id);
      if (playerIds.length === 0) {
        setLoading(false);
        return;
      }

      const { data: statRows, error: statsError } = await supabase
        .from('player_match_stats')
        .select('*')
        .in('player_id', playerIds);
      if (cancelled) return;
      if (statsError) {
        // Commonly means 0008_performance.sql hasn't been run yet -- degrade
        // gracefully rather than blocking the whole screen.
        setStats([]);
      } else {
        setStats(statRows ?? []);
      }

      const fixtureIds = [...new Set((statRows ?? []).map((s) => s.fixture_id))];
      if (fixtureIds.length > 0) {
        const { data: fixtureRows } = await supabase.from('fixtures').select('*').in('id', fixtureIds);
        if (!cancelled && fixtureRows) {
          setFixtures(fixtureRows);
          const opponentClubIds = new Set<string>();
          for (const f of fixtureRows) {
            opponentClubIds.add(f.home_club_id);
            opponentClubIds.add(f.away_club_id);
          }
          const { data: clubRows } = await supabase.from('clubs').select('*').in('id', [...opponentClubIds]);
          if (!cancelled && clubRows) {
            setOpponentsById(new Map(clubRows.map((c) => [c.id, c])));
          }
        }
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [managedClubId]);

  const leaderRows = useMemo(() => buildLeaderRows(stats, players), [stats, players]);
  const rowsByPlayer = useMemo(() => new Map(leaderRows.map((r) => [r.playerId, r])), [leaderRows]);
  const playersById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const outfield = useMemo(() => {
    const rows = leaderRows.filter((r) => r.position !== 'GK');
    return [...rows].sort((a, b) => sortValue(b, sortKey) - sortValue(a, sortKey));
  }, [leaderRows, sortKey]);

  const goalkeepers = useMemo(() => leaderRows.filter((r) => r.position === 'GK'), [leaderRows]);

  const playerLog = useMemo(() => {
    if (!selectedPlayer) return [];
    return stats
      .filter((s) => s.player_id === selectedPlayer.id)
      .map((stat) => {
        const fixture = fixtures.find((f) => f.id === stat.fixture_id);
        if (!fixture) return null;
        const wasHome = fixture.home_club_id === managedClubId;
        const opponentId = wasHome ? fixture.away_club_id : fixture.home_club_id;
        return { stat, fixture, opponent: opponentsById.get(opponentId), wasHome };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => a.fixture.round - b.fixture.round);
  }, [selectedPlayer, stats, fixtures, opponentsById, managedClubId]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Squad</Text>
          <Text style={styles.title}>Performance</Text>
        </View>

        {loading && <ActivityIndicator style={styles.spinner} color={baseColors.textSecondary} />}
        {error && <Text style={styles.error}>{error}</Text>}
        {!loading && !error && stats.length === 0 && (
          <Text style={styles.empty}>No matches played yet this season — stats will show up here after Round 1.</Text>
        )}

        {!loading && stats.length > 0 && (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.sortRow}>
              {SORT_OPTIONS.map((opt) => (
                <PressableScale
                  key={opt.key}
                  onPress={() => setSortKey(opt.key)}
                  style={[
                    styles.sortChip,
                    sortKey === opt.key && { backgroundColor: theme.accent, borderColor: theme.accent },
                  ]}>
                  <Text style={[styles.sortChipText, sortKey === opt.key && styles.sortChipTextActive]}>
                    {opt.label}
                  </Text>
                </PressableScale>
              ))}
            </View>

            <ScrollView horizontal contentContainerStyle={styles.table}>
              <View>
                <TableHeader />
                {outfield.map((row) => (
                  <PlayerRow
                    key={row.playerId}
                    row={row}
                    player={playersById.get(row.playerId)}
                    onPress={() => setSelectedPlayer(playersById.get(row.playerId) ?? null)}
                  />
                ))}
              </View>
            </ScrollView>

            {goalkeepers.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Goalkeepers</Text>
                <ScrollView horizontal contentContainerStyle={styles.table}>
                  <View>
                    <GkTableHeader />
                    {goalkeepers.map((row) => (
                      <GkRow
                        key={row.playerId}
                        row={row}
                        player={playersById.get(row.playerId)}
                        onPress={() => setSelectedPlayer(playersById.get(row.playerId) ?? null)}
                      />
                    ))}
                  </View>
                </ScrollView>
              </>
            )}
          </ScrollView>
        )}
      </SafeAreaView>

      <PlayerMatchLogSheet
        playerName={selectedPlayer?.full_name ?? null}
        rows={playerLog}
        onClose={() => setSelectedPlayer(null)}
      />
    </View>
  );
}

function FormArrowFor({ player, seasonAvg }: { player: Player | undefined; seasonAvg: number }) {
  if (!player || player.form == null || seasonAvg === 0) return <Text style={styles.cell}>—</Text>;
  const delta = player.form - seasonAvg;
  if (Math.abs(delta) < 0.2) return <Text style={[styles.cell, { color: baseColors.textTertiary }]}>—</Text>;
  return (
    <Text style={[styles.cell, { color: delta > 0 ? '#3ECF6B' : '#F2544C' }]}>{delta > 0 ? '▲' : '▼'}</Text>
  );
}

function TableHeader() {
  return (
    <View style={styles.headerRow}>
      <Text style={[styles.headerCell, styles.nameCol]}>Player</Text>
      <Text style={styles.headerCell}>Apps</Text>
      <Text style={styles.headerCell}>Mins</Text>
      <Text style={styles.headerCell}>G</Text>
      <Text style={styles.headerCell}>A</Text>
      <Text style={styles.headerCell}>Rating</Text>
      <Text style={styles.headerCell}>Form</Text>
      <Text style={styles.headerCell}>MOTM</Text>
      <Text style={styles.headerCell}>YC</Text>
      <Text style={styles.headerCell}>RC</Text>
    </View>
  );
}

function PlayerRow({ row, player, onPress }: { row: LeaderRow; player: Player | undefined; onPress: () => void }) {
  const unavailable = player ? isInjured(player) || (player.suspended_matches ?? 0) > 0 : false;
  return (
    <PressableScale style={[styles.dataRow, unavailable && styles.dataRowUnavailable]} onPress={onPress}>
      <View style={[styles.cell, styles.nameCol, styles.nameCellRow]}>
        {player && <FatigueDot level={player.fatigue_level} />}
        <Text style={styles.nameText} numberOfLines={1}>
          {row.fullName}
        </Text>
        {player && <OverallBadge overall={player.overall} fatigueLevel={player.fatigue_level} size="sm" />}
      </View>
      <Text style={styles.cell}>{row.apps}</Text>
      <Text style={styles.cell}>{row.minutes}</Text>
      <Text style={styles.cell}>{row.goals}</Text>
      <Text style={styles.cell}>{row.assists}</Text>
      <Text style={styles.cell}>{row.avgRating.toFixed(1)}</Text>
      <FormArrowFor player={player} seasonAvg={row.avgRating} />
      <Text style={styles.cell}>{row.motm}</Text>
      <Text style={styles.cell}>{row.yellowCards}</Text>
      <Text style={styles.cell}>{row.redCards}</Text>
    </PressableScale>
  );
}

function GkTableHeader() {
  return (
    <View style={styles.headerRow}>
      <Text style={[styles.headerCell, styles.nameCol]}>Player</Text>
      <Text style={styles.headerCell}>Apps</Text>
      <Text style={styles.headerCell}>CS</Text>
      <Text style={styles.headerCell}>Saves</Text>
      <Text style={styles.headerCell}>GC</Text>
      <Text style={styles.headerCell}>Save%</Text>
      <Text style={styles.headerCell}>Rating</Text>
    </View>
  );
}

function GkRow({ row, player, onPress }: { row: LeaderRow; player: Player | undefined; onPress: () => void }) {
  const unavailable = player ? isInjured(player) || (player.suspended_matches ?? 0) > 0 : false;
  const totalShotsFaced = row.saves + row.goalsConceded;
  const savePct = totalShotsFaced > 0 ? Math.round((row.saves / totalShotsFaced) * 100) : null;

  return (
    <PressableScale style={[styles.dataRow, unavailable && styles.dataRowUnavailable]} onPress={onPress}>
      <View style={[styles.cell, styles.nameCol, styles.nameCellRow]}>
        {player && <FatigueDot level={player.fatigue_level} />}
        <Text style={styles.nameText} numberOfLines={1}>
          {row.fullName}
        </Text>
        {player && <OverallBadge overall={player.overall} fatigueLevel={player.fatigue_level} size="sm" />}
      </View>
      <Text style={styles.cell}>{row.apps}</Text>
      <Text style={styles.cell}>{row.cleanSheets}</Text>
      <Text style={styles.cell}>{row.saves}</Text>
      <Text style={styles.cell}>{row.goalsConceded}</Text>
      <Text style={styles.cell}>{savePct != null ? `${savePct}%` : '—'}</Text>
      <Text style={styles.cell}>{row.avgRating.toFixed(1)}</Text>
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
  spinner: {
    marginTop: spacing.xl,
  },
  error: {
    ...typography.body,
    color: '#F2544C',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  empty: {
    ...typography.body,
    color: baseColors.textSecondary,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  sortRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  sortChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: baseColors.surfaceElevated,
    borderColor: baseColors.border,
  },
  sortChipText: {
    ...typography.caption,
    color: baseColors.textSecondary,
  },
  sortChipTextActive: {
    color: baseColors.textInverse,
  },
  sectionLabel: {
    ...typography.eyebrow,
    color: baseColors.textTertiary,
    marginTop: spacing.sm,
  },
  table: {
    flexDirection: 'column',
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: baseColors.border,
    paddingBottom: spacing.sm,
    marginBottom: spacing.xs,
  },
  headerCell: {
    ...typography.eyebrow,
    fontSize: 10,
    color: baseColors.textTertiary,
    width: 56,
    textAlign: 'center',
  },
  nameCol: {
    width: 200,
    textAlign: 'left',
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: baseColors.border,
  },
  dataRowUnavailable: {
    opacity: 0.45,
  },
  cell: {
    ...typography.caption,
    color: baseColors.textPrimary,
    width: 56,
    textAlign: 'center',
  },
  nameCellRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  nameText: {
    ...typography.bodyBold,
    color: baseColors.textPrimary,
    flexShrink: 1,
  },
});
