import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ClubCrest } from '@/components/ClubCrest';
import { FatigueDot } from '@/components/FatigueDot';
import { FormGuide, MomentumLabel } from '@/components/FormGuide';
import { OverallBadge } from '@/components/OverallBadge';
import { PlayerDetailSheet } from '@/components/PlayerDetailSheet';
import { PositionPill } from '@/components/PositionPill';
import { PressableScale } from '@/components/PressableScale';
import { StatBar } from '@/components/StatBar';
import { useAuth } from '@/lib/auth-context';
import type { FormationKey } from '@/lib/formations';
import { computeLineupRating, type ClubRating, type SlotAssignment } from '@/lib/lineup';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/lib/use-profile';
import { baseColors, radius, spacing, typography, useClubTheme } from '@/theme';
import type { Club, Player, PlayerPosition } from '@/types';

type SortKey = 'overall' | 'position' | 'age' | 'value';
const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'overall', label: 'Overall' },
  { key: 'position', label: 'Position' },
  { key: 'age', label: 'Age' },
  { key: 'value', label: 'Value' },
];
const POSITION_FILTERS: PlayerPosition[] = ['GK', 'DF', 'MF', 'FW'];
const POSITION_ORDER: Record<PlayerPosition, number> = { GK: 0, DF: 1, MF: 2, FW: 3 };

function formatMarketValue(value: number): string {
  if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `€${Math.round(value / 1000)}K`;
  return `€${value}`;
}

export default function SquadScreen() {
  const { session } = useAuth();
  const { profile } = useProfile(session);
  const theme = useClubTheme();

  const [club, setClub] = useState<Club | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>('overall');
  const [sortDescending, setSortDescending] = useState(true);
  const [positionFilter, setPositionFilter] = useState<PlayerPosition | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [savedLineup, setSavedLineup] = useState<{ formation: FormationKey; assignment: SlotAssignment } | null>(
    null
  );

  const managedClubId = profile?.managed_club_id ?? null;

  // Refetches every time this tab gains focus (not just on first mount) --
  // Expo Router keeps tab screens mounted when you switch tabs, so without
  // this, playing a match on the Fixtures tab wouldn't be reflected here
  // (fresh fatigue/overall/rating) until the app was reloaded.
  useFocusEffect(
    useCallback(() => {
      if (!managedClubId) {
        setLoading(false);
        return;
      }
      let cancelled = false;
      setLoading(true);

      Promise.all([
        supabase.from('clubs').select('*').eq('id', managedClubId).single(),
        supabase.from('players').select('*').eq('club_id', managedClubId),
      ]).then(([clubResult, playersResult]) => {
        if (cancelled) return;
        if (clubResult.error) setError(clubResult.error.message);
        else setClub(clubResult.data);
        if (playersResult.error) setError(playersResult.error.message);
        else setPlayers(playersResult.data ?? []);
        setLoading(false);
      });

      return () => {
        cancelled = true;
      };
    }, [managedClubId])
  );

  // Load the manager's saved lineup so the header shows the SAME rating
  // (attack/mid/def included) as the lineup screen -- "there is ONE club
  // rating". Falls back to just club.current_rating (no bars) if no
  // lineup has ever been saved yet.
  useFocusEffect(
    useCallback(() => {
      if (players.length === 0 || !session) return;
      let cancelled = false;

      (async () => {
        const { data: lineupRows } = await supabase
          .from('lineups')
          .select('id, formation')
          .eq('profile_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(1);
        if (cancelled || !lineupRows || lineupRows.length === 0) return;

        const { data: slotRows } = await supabase
          .from('lineup_slots')
          .select('slot_key, player_id')
          .eq('lineup_id', lineupRows[0].id);
        if (cancelled || !slotRows || slotRows.length === 0) return;

        const assignment: SlotAssignment = {};
        for (const row of slotRows) assignment[row.slot_key] = row.player_id;
        setSavedLineup({ formation: lineupRows[0].formation as FormationKey, assignment });
      })();

      return () => {
        cancelled = true;
      };
      // players.length (not `players`) so this doesn't re-run on every
      // refetch above -- only when the squad goes from empty to non-empty,
      // and on every focus thereafter.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [players.length > 0, session?.user.id])
  );

  const playersById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const clubRating: ClubRating = useMemo(() => {
    if (savedLineup) {
      const live = computeLineupRating(savedLineup.formation, savedLineup.assignment, playersById);
      if (live.overall > 0) return live;
    }
    const persisted = (club?.current_rating ?? 0) as ClubRating['overall'];
    const zero = 0 as ClubRating['overall'];
    return { overall: persisted, attack: zero, midfield: zero, defence: zero };
  }, [savedLineup, playersById, club?.current_rating]);

  const visiblePlayers = useMemo(() => {
    let list = players;
    if (positionFilter) {
      list = list.filter((p) => p.position === positionFilter);
    }

    const sorted = [...list].sort((a, b) => {
      let diff = 0;
      switch (sortKey) {
        case 'overall':
          diff = (a.overall ?? -1) - (b.overall ?? -1);
          break;
        case 'position':
          diff = POSITION_ORDER[a.position] - POSITION_ORDER[b.position];
          break;
        case 'age':
          diff = (a.age ?? -1) - (b.age ?? -1);
          break;
        case 'value':
          diff = a.market_value - b.market_value;
          break;
      }
      return sortDescending ? -diff : diff;
    });

    return sorted;
  }, [players, positionFilter, sortKey, sortDescending]);

  const onSortPress = (key: SortKey) => {
    if (key === sortKey) {
      setSortDescending((prev) => !prev);
    } else {
      setSortKey(key);
      setSortDescending(true);
    }
  };

  const switchClub = async () => {
    if (!session) return;
    // Owner-permitted update (see "profiles are updatable by their owner" in
    // 0001_init.sql) -- no admin access needed, unlike the one-off fix that
    // unblocked this account the first time this gap was hit.
    await supabase.from('profiles').update({ managed_club_id: null }).eq('id', session.user.id);
    router.replace('/pick-club');
  };

  const signOut = () => supabase.auth.signOut();

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <ClubCrest
              primaryColour={club?.primary_colour}
              secondaryColour={club?.secondary_colour}
              initials={club?.crest_initials}
              logoUrl={club?.logo_url}
              fallbackName={club?.short_name}
              size="md"
            />
            <View style={styles.headerTitleBlock}>
              <Text style={styles.headerEyebrow}>Your Club</Text>
              <Text style={styles.headerName} numberOfLines={1}>
                {club?.name ?? '—'}
              </Text>
              <FormGuide formString={club?.form_string ?? null} size="sm" />
            </View>
            <View style={styles.ratingBlock}>
              <OverallBadge overall={clubRating.overall > 0 ? clubRating.overall : null} size="lg" />
              <MomentumLabel momentum={club?.momentum ?? null} />
            </View>
          </View>

          {savedLineup ? (
            <View style={styles.headerBars}>
              <StatBar label="Attack" value={clubRating.attack} color="#F2544C" />
              <StatBar label="Midfield" value={clubRating.midfield} color="#3ECF6B" />
              <StatBar label="Defence" value={clubRating.defence} color="#4C8DF2" />
            </View>
          ) : (
            <Text style={styles.noLineupHint}>Save a lineup to see attack/midfield/defence.</Text>
          )}

          <View style={styles.headerActions}>
            <PressableScale onPress={switchClub}>
              <Text style={styles.headerActionText}>Switch Club</Text>
            </PressableScale>
            <Text style={styles.headerActionDivider}>·</Text>
            <PressableScale onPress={signOut}>
              <Text style={styles.headerActionText}>Sign Out</Text>
            </PressableScale>
          </View>
        </View>

        <View style={styles.controls}>
          <View style={styles.chipRow}>
            <FilterChip label="All" active={positionFilter == null} onPress={() => setPositionFilter(null)} />
            {POSITION_FILTERS.map((pos) => (
              <FilterChip
                key={pos}
                label={pos}
                active={positionFilter === pos}
                onPress={() => setPositionFilter(pos)}
              />
            ))}
          </View>
          <View style={styles.chipRow}>
            {SORT_OPTIONS.map((opt) => (
              <SortChip
                key={opt.key}
                label={opt.label}
                active={sortKey === opt.key}
                descending={sortDescending}
                onPress={() => onSortPress(opt.key)}
              />
            ))}
          </View>
        </View>

        {loading && <ActivityIndicator style={styles.spinner} color={baseColors.textSecondary} />}
        {error && <Text style={styles.error}>{error}</Text>}
        {!loading && !error && visiblePlayers.length === 0 && (
          <Text style={styles.empty}>No players match this filter.</Text>
        )}

        <FlatList
          data={visiblePlayers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => (
            <PlayerRow player={item} index={index} accent={theme.accent} onPress={() => setSelectedPlayer(item)} />
          )}
        />
      </SafeAreaView>

      <PlayerDetailSheet player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
    </View>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useClubTheme();
  return (
    <PressableScale
      onPress={onPress}
      style={[
        styles.chip,
        active ? { backgroundColor: theme.accent, borderColor: theme.accent } : styles.chipInactive,
      ]}>
      <Text style={[styles.chipText, active && { color: baseColors.textInverse }]}>{label}</Text>
    </PressableScale>
  );
}

function SortChip({
  label,
  active,
  descending,
  onPress,
}: {
  label: string;
  active: boolean;
  descending: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} style={[styles.chip, active ? styles.chipSortActive : styles.chipInactive]}>
      <Text style={[styles.chipText, active && styles.chipSortActiveText]}>
        {label}
        {active ? (descending ? ' ↓' : ' ↑') : ''}
      </Text>
    </PressableScale>
  );
}

function PlayerRow({
  player,
  index,
  accent,
  onPress,
}: {
  player: Player;
  index: number;
  accent: string;
  onPress: () => void;
}) {
  const unavailable = isInjured(player) || (player.suspended_matches ?? 0) > 0;

  return (
    <Animated.View entering={FadeInDown.duration(220).delay(Math.min(index, 12) * 25)}>
      <PressableScale style={[styles.playerRow, unavailable && styles.playerRowUnavailable]} onPress={onPress} scaleTo={0.98}>
        <OverallBadge overall={player.overall} fatigueLevel={player.fatigue_level} size="md" />
        <View style={styles.playerInfo}>
          <View style={styles.playerNameRow}>
            <FatigueDot level={player.fatigue_level} />
            <Text style={styles.playerName} numberOfLines={1}>
              {player.full_name}
            </Text>
          </View>
          <View style={styles.playerMeta}>
            <PositionPill position={player.position} size="sm" />
            <Text style={styles.playerMetaText}>Age {player.age ?? '—'}</Text>
            {unavailable && (
              <Text style={styles.unavailableText}>{isInjured(player) ? 'Injured' : 'Suspended'}</Text>
            )}
          </View>
        </View>
        <Text style={[styles.playerValue, { color: accent }]}>{formatMarketValue(player.market_value)}</Text>
      </PressableScale>
    </Animated.View>
  );
}

function isInjured(player: Player): boolean {
  if (!player.injured_until) return false;
  return player.injured_until >= new Date().toISOString().slice(0, 10);
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
    backgroundColor: baseColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: baseColors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerTitleBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  ratingBlock: {
    alignItems: 'center',
    gap: 2,
  },
  headerEyebrow: {
    ...typography.eyebrow,
    color: baseColors.textTertiary,
  },
  headerName: {
    ...typography.displayLG,
    color: baseColors.textPrimary,
  },
  headerBars: {
    gap: spacing.sm,
  },
  noLineupHint: {
    ...typography.caption,
    color: baseColors.textTertiary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerActionText: {
    ...typography.caption,
    color: baseColors.textSecondary,
  },
  headerActionDivider: {
    ...typography.caption,
    color: baseColors.textTertiary,
  },
  controls: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipInactive: {
    backgroundColor: baseColors.surfaceElevated,
    borderColor: baseColors.border,
  },
  chipSortActive: {
    backgroundColor: baseColors.surfaceElevated,
    borderColor: baseColors.borderStrong,
  },
  chipText: {
    ...typography.caption,
    color: baseColors.textSecondary,
  },
  chipSortActiveText: {
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
  listContent: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: baseColors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: baseColors.border,
    padding: spacing.md,
  },
  playerRowUnavailable: {
    opacity: 0.5,
  },
  playerInfo: {
    flex: 1,
    gap: 4,
  },
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  playerName: {
    ...typography.bodyBold,
    color: baseColors.textPrimary,
  },
  playerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  unavailableText: {
    ...typography.caption,
    color: '#F2544C',
  },
  playerMetaText: {
    ...typography.caption,
    color: baseColors.textTertiary,
  },
  playerValue: {
    ...typography.numericMD,
  },
});
