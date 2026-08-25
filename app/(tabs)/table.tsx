import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ClubCrest } from '@/components/ClubCrest';
import { FormGuide } from '@/components/FormGuide';
import { PlayerDetailSheet } from '@/components/PlayerDetailSheet';
import { PressableScale } from '@/components/PressableScale';
import { RatingLeadersTab } from '@/components/RatingLeadersTab';
import { ScorersLeadersTab } from '@/components/ScorersLeadersTab';
import { useAuth } from '@/lib/auth-context';
import { buildLeaderRows, topScorers } from '@/lib/leaders';
import { computeStandings, type StandingsRow } from '@/lib/standings';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/lib/use-profile';
import { baseColors, radius, spacing, typography, useClubTheme } from '@/theme';
import type { Club, Fixture, Player, PlayerMatchStat, PlayerPosition } from '@/types';

type TopTab = 'table' | 'scorers' | 'rating';
type Density = 'compact' | 'detailed';
type SortKey = 'played' | 'w' | 'd' | 'l' | 'gf' | 'ga' | 'gd' | 'points';
type ResultLetter = 'W' | 'D' | 'L';

const TOP_TABS: Array<{ key: TopTab; label: string }> = [
  { key: 'table', label: 'Table' },
  { key: 'scorers', label: 'Scorers' },
  { key: 'rating', label: 'Rating' },
];

function resultFor(fixture: Fixture, clubId: string): ResultLetter {
  const isHome = fixture.home_club_id === clubId;
  const gf = (isHome ? fixture.home_goals : fixture.away_goals) ?? 0;
  const ga = (isHome ? fixture.away_goals : fixture.home_goals) ?? 0;
  return gf > ga ? 'W' : gf < ga ? 'L' : 'D';
}

function currentStreak(clubId: string, fixtures: Fixture[]): string {
  const played = fixtures
    .filter((f) => f.status === 'finished' && (f.home_club_id === clubId || f.away_club_id === clubId))
    .sort((a, b) => b.round - a.round);
  if (played.length === 0) return '—';
  const first = resultFor(played[0], clubId);
  let count = 0;
  for (const f of played) {
    if (resultFor(f, clubId) === first) count += 1;
    else break;
  }
  return `${count}${first}`;
}

function homeAwayRecord(clubId: string, fixtures: Fixture[]) {
  const record = {
    home: { w: 0, d: 0, l: 0 },
    away: { w: 0, d: 0, l: 0 },
  };
  for (const f of fixtures) {
    if (f.status !== 'finished') continue;
    const isHome = f.home_club_id === clubId;
    if (!isHome && f.away_club_id !== clubId) continue;
    const result = resultFor(f, clubId);
    const bucket = isHome ? record.home : record.away;
    if (result === 'W') bucket.w += 1;
    else if (result === 'L') bucket.l += 1;
    else bucket.d += 1;
  }
  return record;
}

function nextFixtureFor(clubId: string, fixtures: Fixture[]): Fixture | null {
  return (
    fixtures
      .filter((f) => f.status === 'scheduled' && (f.home_club_id === clubId || f.away_club_id === clubId))
      .sort((a, b) => a.round - b.round)[0] ?? null
  );
}

/** Top 2 = European qualification, next 4 = playoff split, bottom 2 = relegation -- proportional to however many clubs are in the table. */
function zoneFor(position: number, total: number): 'european' | 'playoff' | 'relegation' | null {
  if (position <= 2) return 'european';
  if (position <= 6) return 'playoff';
  if (position > total - 2) return 'relegation';
  return null;
}

const ZONE_TINT: Record<'european' | 'playoff' | 'relegation', string> = {
  european: 'rgba(76,141,242,0.09)',
  playoff: 'rgba(242,201,76,0.07)',
  relegation: 'rgba(242,84,76,0.09)',
};

export default function TableScreen() {
  const { session } = useAuth();
  const { profile } = useProfile(session);
  const theme = useClubTheme();

  const [clubs, setClubs] = useState<Club[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [stats, setStats] = useState<PlayerMatchStat[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [topTab, setTopTab] = useState<TopTab>('table');
  const [density, setDensity] = useState<Density>('detailed');
  const [expandedClubId, setExpandedClubId] = useState<string | null>(null);
  const [sortOverride, setSortOverride] = useState<{ key: SortKey; descending: boolean } | null>(null);
  const [scorersMode, setScorersMode] = useState<'goals' | 'assists'>('goals');
  const [ratingPositionFilter, setRatingPositionFilter] = useState<PlayerPosition | 'ALL'>('ALL');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  const managedClubId = profile?.managed_club_id ?? null;
  const seasonId = profile?.current_season_id ?? null;

  useFocusEffect(
    useCallback(() => {
      if (!seasonId) {
        setLoading(false);
        return;
      }
      let cancelled = false;
      setLoading(true);

      (async () => {
        const [clubsRes, fixturesRes] = await Promise.all([
          supabase.from('clubs').select('*'),
          supabase.from('fixtures').select('*').eq('season_id', seasonId).eq('competition', 'league'),
        ]);
        if (cancelled) return;
        if (clubsRes.error) setError(clubsRes.error.message);
        else setClubs(clubsRes.data ?? []);
        if (fixturesRes.error) setError(fixturesRes.error.message);
        else setError(null);
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
    }, [seasonId])
  );

  const clubsById = useMemo(() => new Map(clubs.map((c) => [c.id, c])), [clubs]);
  const standings = useMemo(() => computeStandings(fixtures, clubs), [fixtures, clubs]);

  const maxFinishedRound = useMemo(
    () => fixtures.filter((f) => f.status === 'finished').reduce((max, f) => Math.max(max, f.round), 0),
    [fixtures]
  );
  const previousStandings = useMemo(
    () => (maxFinishedRound > 1 ? computeStandings(fixtures.filter((f) => f.round < maxFinishedRound), clubs) : null),
    [fixtures, clubs, maxFinishedRound]
  );
  const movementFor = useCallback(
    (clubId: string): 'up' | 'down' | 'same' => {
      if (!previousStandings) return 'same';
      const nowIndex = standings.findIndex((r) => r.club.id === clubId);
      const prevIndex = previousStandings.findIndex((r) => r.club.id === clubId);
      if (prevIndex === -1 || nowIndex === -1) return 'same';
      if (prevIndex > nowIndex) return 'up';
      if (prevIndex < nowIndex) return 'down';
      return 'same';
    },
    [standings, previousStandings]
  );

  const sortedRows = useMemo(() => {
    if (!sortOverride) return standings;
    const value = (r: StandingsRow): number => {
      switch (sortOverride.key) {
        case 'played':
          return r.played;
        case 'w':
          return r.won;
        case 'd':
          return r.drawn;
        case 'l':
          return r.lost;
        case 'gf':
          return r.goalsFor;
        case 'ga':
          return r.goalsAgainst;
        case 'gd':
          return r.goalDifference;
        case 'points':
          return r.points;
      }
    };
    const copy = [...standings].sort((a, b) => value(b) - value(a));
    return sortOverride.descending ? copy : copy.reverse();
  }, [standings, sortOverride]);

  const toggleSort = (key: SortKey) => {
    setSortOverride((prev) => {
      if (!prev || prev.key !== key) return { key, descending: true };
      if (prev.descending) return { key, descending: false };
      return null; // third tap -- back to the default league-rules order
    });
  };

  const leaderRows = useMemo(() => buildLeaderRows(stats, players), [stats, players]);
  const playersById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const selectedPlayer = selectedPlayerId ? playersById.get(selectedPlayerId) ?? null : null;

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Ligat ha&apos;Al</Text>
          <Text style={styles.title}>League</Text>
        </View>

        <View style={styles.tabRow}>
          {TOP_TABS.map((tab) => (
            <PressableScale
              key={tab.key}
              style={[styles.tabButton, topTab === tab.key && { backgroundColor: theme.accent }]}
              onPress={() => setTopTab(tab.key)}>
              <Text style={[styles.tabButtonText, topTab === tab.key && styles.tabButtonTextActive]}>{tab.label}</Text>
            </PressableScale>
          ))}
        </View>

        {loading && <ActivityIndicator style={styles.spinner} color={baseColors.textSecondary} />}
        {error && <Text style={styles.error}>{error}</Text>}

        {!loading && !error && (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {topTab === 'table' && (
              <LeagueTableTab
                rows={sortedRows}
                fixtures={fixtures}
                leaderRows={leaderRows}
                managedClubId={managedClubId}
                accent={theme.accent}
                density={density}
                onDensityChange={setDensity}
                sortOverride={sortOverride}
                onToggleSort={toggleSort}
                movementFor={movementFor}
                expandedClubId={expandedClubId}
                onToggleExpand={(id) => setExpandedClubId((prev) => (prev === id ? null : id))}
                onViewClub={(id) => router.push({ pathname: '/club/[clubId]', params: { clubId: id } })}
              />
            )}
            {topTab === 'scorers' && (
              <ScorersLeadersTab
                mode={scorersMode}
                onModeChange={setScorersMode}
                rows={leaderRows}
                clubsById={clubsById}
                managedClubId={managedClubId}
                onSelectPlayer={setSelectedPlayerId}
              />
            )}
            {topTab === 'rating' && (
              <RatingLeadersTab
                rows={leaderRows}
                positionFilter={ratingPositionFilter}
                onPositionFilterChange={setRatingPositionFilter}
                clubsById={clubsById}
                onSelectPlayer={setSelectedPlayerId}
              />
            )}
          </ScrollView>
        )}
      </SafeAreaView>

      <PlayerDetailSheet player={selectedPlayer} onClose={() => setSelectedPlayerId(null)} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// League table tab
// ---------------------------------------------------------------------------

type LeagueTableTabProps = {
  rows: StandingsRow[];
  fixtures: Fixture[];
  leaderRows: ReturnType<typeof buildLeaderRows>;
  managedClubId: string | null;
  accent: string;
  density: Density;
  onDensityChange: (d: Density) => void;
  sortOverride: { key: SortKey; descending: boolean } | null;
  onToggleSort: (key: SortKey) => void;
  movementFor: (clubId: string) => 'up' | 'down' | 'same';
  expandedClubId: string | null;
  onToggleExpand: (clubId: string) => void;
  onViewClub: (clubId: string) => void;
};

function LeagueTableTab({
  rows,
  fixtures,
  leaderRows,
  managedClubId,
  accent,
  density,
  onDensityChange,
  sortOverride,
  onToggleSort,
  movementFor,
  expandedClubId,
  onToggleExpand,
  onViewClub,
}: LeagueTableTabProps) {
  const total = rows.length;

  const table = (
    <View>
      <ColumnHeader density={density} sortOverride={sortOverride} onToggleSort={onToggleSort} />
      {rows.map((row, index) => {
        const position = index + 1;
        const zone = zoneFor(position, total);
        return (
          <TableRow
            key={row.club.id}
            row={row}
            position={position}
            zone={zone}
            highlighted={row.club.id === managedClubId}
            accent={accent}
            density={density}
            movement={movementFor(row.club.id)}
            expanded={expandedClubId === row.club.id}
            onToggleExpand={() => onToggleExpand(row.club.id)}
            onViewClub={() => onViewClub(row.club.id)}
            fixtures={fixtures}
            leaderRows={leaderRows}
          />
        );
      })}
    </View>
  );

  return (
    <View style={styles.tableTabContainer}>
      <View style={styles.controlsRow}>
        <View style={styles.densityToggle}>
          <PressableScale
            style={[styles.densityButton, density === 'compact' && styles.densityButtonActive]}
            onPress={() => onDensityChange('compact')}>
            <Text style={[styles.densityText, density === 'compact' && styles.densityTextActive]}>Compact</Text>
          </PressableScale>
          <PressableScale
            style={[styles.densityButton, density === 'detailed' && styles.densityButtonActive]}
            onPress={() => onDensityChange('detailed')}>
            <Text style={[styles.densityText, density === 'detailed' && styles.densityTextActive]}>Detailed</Text>
          </PressableScale>
        </View>
      </View>

      {density === 'compact' ? table : <ScrollView horizontal showsHorizontalScrollIndicator={false}>{table}</ScrollView>}

      <Legend />
    </View>
  );
}

function ColumnHeader({
  density,
  sortOverride,
  onToggleSort,
}: {
  density: Density;
  sortOverride: { key: SortKey; descending: boolean } | null;
  onToggleSort: (key: SortKey) => void;
}) {
  const HeaderCell = ({ label, sortKey, style }: { label: string; sortKey?: SortKey; style?: object }) => {
    const active = sortKey != null && sortOverride?.key === sortKey;
    const content = (
      <Text style={[styles.columnHeaderText, style, active && styles.columnHeaderTextActive]}>
        {label}
        {active ? (sortOverride!.descending ? ' ↓' : ' ↑') : ''}
      </Text>
    );
    if (!sortKey) return <View style={style}>{content}</View>;
    return (
      <PressableScale style={style} onPress={() => onToggleSort(sortKey)}>
        {content}
      </PressableScale>
    );
  };

  return (
    <View style={styles.columnHeaderRow}>
      <HeaderCell label="#" style={styles.colPos} />
      <View style={styles.colCrest} />
      <HeaderCell label="Club" style={styles.colClub} />
      <HeaderCell label="P" sortKey="played" style={styles.colStat} />
      {density === 'detailed' && (
        <>
          <HeaderCell label="W" sortKey="w" style={styles.colStat} />
          <HeaderCell label="D" sortKey="d" style={styles.colStat} />
          <HeaderCell label="L" sortKey="l" style={styles.colStat} />
          <HeaderCell label="GF" sortKey="gf" style={styles.colStat} />
          <HeaderCell label="GA" sortKey="ga" style={styles.colStat} />
        </>
      )}
      <HeaderCell label="GD" sortKey="gd" style={styles.colStat} />
      <HeaderCell label="Pts" sortKey="points" style={styles.colPts} />
      {density === 'detailed' && <HeaderCell label="Form" style={styles.colForm} />}
      <View style={styles.colMove} />
    </View>
  );
}

function MovementIndicator({ movement }: { movement: 'up' | 'down' | 'same' }) {
  if (movement === 'up') return <Text style={[styles.movement, { color: '#3ECF6B' }]}>▲</Text>;
  if (movement === 'down') return <Text style={[styles.movement, { color: '#F2544C' }]}>▼</Text>;
  return <Text style={[styles.movement, { color: baseColors.textTertiary }]}>–</Text>;
}

function TableRow({
  row,
  position,
  zone,
  highlighted,
  accent,
  density,
  movement,
  expanded,
  onToggleExpand,
  onViewClub,
  fixtures,
  leaderRows,
}: {
  row: StandingsRow;
  position: number;
  zone: 'european' | 'playoff' | 'relegation' | null;
  highlighted: boolean;
  accent: string;
  density: Density;
  movement: 'up' | 'down' | 'same';
  expanded: boolean;
  onToggleExpand: () => void;
  onViewClub: () => void;
  fixtures: Fixture[];
  leaderRows: ReturnType<typeof buildLeaderRows>;
}) {
  const barColor = row.club.primary_colour || baseColors.accentFallback;
  const zoneTint = zone ? ZONE_TINT[zone] : undefined;

  return (
    <View>
      <PressableScale
        style={[
          styles.row,
          zoneTint ? { backgroundColor: zoneTint } : undefined,
          highlighted && { backgroundColor: `${accent}1A`, borderColor: accent },
        ]}
        onPress={onToggleExpand}>
        <View style={[styles.leadingBar, { backgroundColor: barColor }]} />
        <Text style={[styles.cellText, styles.colPos]}>{position}</Text>
        <View style={styles.colCrest}>
          <ClubCrest
            primaryColour={row.club.primary_colour}
            secondaryColour={row.club.secondary_colour}
            initials={row.club.crest_initials}
            logoUrl={row.club.logo_url}
            fallbackName={row.club.short_name}
            size="sm"
          />
        </View>
        <Text style={[styles.cellText, styles.colClub, styles.clubNameText, highlighted && { color: accent, fontWeight: '800' }]} numberOfLines={1}>
          {row.club.name}
        </Text>
        <Text style={[styles.cellText, styles.colStat]}>{row.played}</Text>
        {density === 'detailed' && (
          <>
            <Text style={[styles.cellText, styles.colStat]}>{row.won}</Text>
            <Text style={[styles.cellText, styles.colStat]}>{row.drawn}</Text>
            <Text style={[styles.cellText, styles.colStat]}>{row.lost}</Text>
            <Text style={[styles.cellText, styles.colStat]}>{row.goalsFor}</Text>
            <Text style={[styles.cellText, styles.colStat]}>{row.goalsAgainst}</Text>
          </>
        )}
        <Text style={[styles.cellText, styles.colStat]}>{row.goalDifference}</Text>
        <Text style={[styles.cellText, styles.colPts, styles.pts]}>{row.points}</Text>
        {density === 'detailed' && (
          <View style={styles.colForm}>
            <FormGuide formString={row.club.form_string} size="sm" />
          </View>
        )}
        <View style={styles.colMove}>
          <MovementIndicator movement={movement} />
        </View>
      </PressableScale>

      {expanded && (
        <ExpandedRow row={row} fixtures={fixtures} leaderRows={leaderRows} onViewClub={onViewClub} />
      )}
    </View>
  );
}

function ExpandedRow({
  row,
  fixtures,
  leaderRows,
  onViewClub,
}: {
  row: StandingsRow;
  fixtures: Fixture[];
  leaderRows: ReturnType<typeof buildLeaderRows>;
  onViewClub: () => void;
}) {
  const clubId = row.club.id;
  const record = homeAwayRecord(clubId, fixtures);
  const streak = currentStreak(clubId, fixtures);
  const next = nextFixtureFor(clubId, fixtures);
  const topScorer = topScorers(
    leaderRows.filter((r) => r.clubId === clubId),
    1
  )[0];

  return (
    <View style={styles.expanded}>
      <View style={styles.expandedGrid}>
        <ExpandedFact label="Home Record" value={`${record.home.w}-${record.home.d}-${record.home.l}`} />
        <ExpandedFact label="Away Record" value={`${record.away.w}-${record.away.d}-${record.away.l}`} />
        <ExpandedFact label="Current Streak" value={streak} />
        <ExpandedFact label="Avg XI Rating" value={row.club.current_rating != null ? String(row.club.current_rating) : '—'} />
        <ExpandedFact label="Top Scorer" value={topScorer ? `${topScorer.fullName} (${topScorer.goals})` : '—'} />
        <ExpandedFact label="Next Fixture" value={next ? `Round ${next.round}` : 'Season complete'} />
      </View>
      <PressableScale style={styles.viewClubButton} onPress={onViewClub}>
        <Text style={styles.viewClubText}>View Club</Text>
      </PressableScale>
    </View>
  );
}

function ExpandedFact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.expandedFact}>
      <Text style={styles.expandedFactLabel}>{label}</Text>
      <Text style={styles.expandedFactValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function Legend() {
  return (
    <View style={styles.legend}>
      <LegendItem color={ZONE_TINT.european} label="European Qualification" />
      <LegendItem color={ZONE_TINT.playoff} label="Playoff Split" />
      <LegendItem color={ZONE_TINT.relegation} label="Relegation Zone" />
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: baseColors.background },
  safeArea: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  eyebrow: { ...typography.eyebrow, color: baseColors.textTertiary },
  title: { ...typography.displayXL, color: baseColors.textPrimary },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: baseColors.surfaceElevated,
    borderRadius: radius.pill,
    padding: 3,
  },
  tabButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  tabButtonText: { ...typography.bodyBold, color: baseColors.textTertiary },
  tabButtonTextActive: { color: baseColors.textInverse },
  spinner: { marginTop: spacing.xl },
  error: { ...typography.body, color: '#F2544C', paddingHorizontal: spacing.lg, marginTop: spacing.md },
  scrollContent: { padding: spacing.lg, paddingTop: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },

  tableTabContainer: { gap: spacing.sm },
  controlsRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  densityToggle: { flexDirection: 'row', gap: 4 },
  densityButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: baseColors.border,
    backgroundColor: baseColors.surfaceElevated,
  },
  densityButtonActive: { backgroundColor: baseColors.surfacePressed, borderColor: baseColors.borderStrong },
  densityText: { ...typography.caption, fontSize: 10, color: baseColors.textTertiary },
  densityTextActive: { color: baseColors.textPrimary },

  columnHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: baseColors.border,
    gap: 2,
  },
  columnHeaderText: {
    ...typography.eyebrow,
    fontSize: 9,
    color: baseColors.textTertiary,
    textAlign: 'center',
  },
  columnHeaderTextActive: { color: baseColors.textPrimary },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: baseColors.border,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: radius.sm,
    gap: 2,
    overflow: 'hidden',
  },
  leadingBar: { width: 3, alignSelf: 'stretch', borderRadius: 2, marginRight: 4 },
  cellText: { ...typography.caption, color: baseColors.textSecondary, textAlign: 'center' },
  colPos: { width: 20, textAlign: 'left' },
  colCrest: { width: 28, alignItems: 'center' },
  colClub: { width: 150, textAlign: 'left' },
  clubNameText: { color: baseColors.textPrimary, paddingLeft: 4 },
  colStat: { width: 24 },
  colForm: { width: 96, paddingLeft: spacing.sm },
  colPts: { width: 30 },
  colMove: { width: 20, alignItems: 'center' },
  pts: { ...typography.numericMD, fontSize: 13, color: baseColors.textPrimary },
  movement: { fontSize: 11, fontWeight: '800' },

  expanded: {
    backgroundColor: baseColors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  expandedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  expandedFact: { width: 150, gap: 2 },
  expandedFactLabel: { ...typography.eyebrow, fontSize: 9, color: baseColors.textTertiary },
  expandedFactValue: { ...typography.bodyBold, color: baseColors.textPrimary },
  viewClubButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: baseColors.borderStrong,
  },
  viewClubText: { ...typography.caption, color: baseColors.textPrimary },

  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 12, height: 12, borderRadius: 3 },
  legendText: { ...typography.caption, fontSize: 10, color: baseColors.textTertiary },
});
