import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ClubCrest } from '@/components/ClubCrest';
import { OverallBadge } from '@/components/OverallBadge';
import { PlayerDetailSheet } from '@/components/PlayerDetailSheet';
import { PositionPill } from '@/components/PositionPill';
import { PressableScale } from '@/components/PressableScale';
import { StatBar } from '@/components/StatBar';
import { useAuth } from '@/lib/auth-context';
import { computeClubRating } from '@/lib/ratings';
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

  const managedClubId = profile?.managed_club_id ?? null;

  useEffect(() => {
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
  }, [managedClubId]);

  const clubRating = useMemo(() => {
    const rated = players.filter((p) => p.overall != null).map((p) => ({ position: p.position, overall: p.overall! }));
    return computeClubRating(rated);
  }, [players]);

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
            </View>
            <OverallBadge overall={clubRating.overall > 0 ? clubRating.overall : null} size="lg" />
          </View>

          <View style={styles.headerBars}>
            <StatBar label="Attack" value={clubRating.attack} color="#F2544C" />
            <StatBar label="Midfield" value={clubRating.midfield} color="#3ECF6B" />
            <StatBar label="Defence" value={clubRating.defence} color="#4C8DF2" />
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
  return (
    <Animated.View entering={FadeInDown.duration(220).delay(Math.min(index, 12) * 25)}>
      <PressableScale style={styles.playerRow} onPress={onPress} scaleTo={0.98}>
        <OverallBadge overall={player.overall} size="md" />
        <View style={styles.playerInfo}>
          <Text style={styles.playerName} numberOfLines={1}>
            {player.full_name}
          </Text>
          <View style={styles.playerMeta}>
            <PositionPill position={player.position} size="sm" />
            <Text style={styles.playerMetaText}>Age {player.age ?? '—'}</Text>
          </View>
        </View>
        <Text style={[styles.playerValue, { color: accent }]}>{formatMarketValue(player.market_value)}</Text>
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
  playerInfo: {
    flex: 1,
    gap: 4,
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
  playerMetaText: {
    ...typography.caption,
    color: baseColors.textTertiary,
  },
  playerValue: {
    ...typography.numericMD,
  },
});
