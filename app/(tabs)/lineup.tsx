import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Rect } from 'react-native-svg';

import { FatigueDot } from '@/components/FatigueDot';
import { OverallBadge } from '@/components/OverallBadge';
import { PositionPill } from '@/components/PositionPill';
import { PressableScale } from '@/components/PressableScale';
import { useAuth } from '@/lib/auth-context';
import { effectiveOverall } from '@/lib/fatigue';
import { FORMATION_KEYS, formations, type FormationKey, type FormationSlot } from '@/lib/formations';
import { buildLeaderRows } from '@/lib/leaders';
import {
  adjustedOverall,
  autoPickBestXI,
  autoPickRotationXI,
  benchPlayers,
  computeLineupRating,
  positionPenalty,
  shirtNumberFor,
  type SlotAssignment,
} from '@/lib/lineup';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/lib/use-profile';
import { baseColors, radius, spacing, typography, useClubTheme } from '@/theme';
import type { Club, FatigueLevel, Player, PlayerMatchStat, PlayerPosition } from '@/types';

type BenchSortKey = 'effective' | 'overall' | 'fatigue' | 'form' | 'rating' | 'position';
const BENCH_SORT_OPTIONS: Array<{ key: BenchSortKey; label: string }> = [
  { key: 'effective', label: 'Effective' },
  { key: 'overall', label: 'Overall' },
  { key: 'fatigue', label: 'Fatigue' },
  { key: 'form', label: 'Form' },
  { key: 'rating', label: 'Avg Rating' },
  { key: 'position', label: 'Position' },
];
const POSITION_ORDER: Record<PlayerPosition, number> = { GK: 0, DF: 1, MF: 2, FW: 3 };
const POSITION_FILTERS: PlayerPosition[] = ['GK', 'DF', 'MF', 'FW'];
const FATIGUE_LABEL: Record<FatigueLevel, string> = { fresh: 'Fresh', moderate: 'Moderate', tired: 'Tired' };

export default function LineupScreen() {
  const { session } = useAuth();
  const { profile } = useProfile(session);
  const theme = useClubTheme();
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';

  const [club, setClub] = useState<Club | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [stats, setStats] = useState<PlayerMatchStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formationKey, setFormationKey] = useState<FormationKey>('4-3-3');
  const [assignment, setAssignment] = useState<SlotAssignment>({});
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [existingLineupId, setExistingLineupId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [rotationWarning, setRotationWarning] = useState<string | null>(null);

  const [benchSortKey, setBenchSortKey] = useState<BenchSortKey>('effective');
  const [benchPositionFilter, setBenchPositionFilter] = useState<PlayerPosition | null>(null);
  const [freshOnly, setFreshOnly] = useState(false);
  const [previewPlayerId, setPreviewPlayerId] = useState<string | null>(null);

  const managedClubId = profile?.managed_club_id ?? null;
  const seasonId = profile?.current_season_id ?? null;

  // Load club + squad + this season's stats (for the bench's "avg rating"
  // column). Refetches on every focus -- Expo Router keeps tabs mounted,
  // so this is what keeps fatigue/overall fresh here after a match is
  // played from the Fixtures tab. Deliberately does NOT touch
  // `assignment`/`formationKey` (the user's in-progress edit), which is
  // hydrated once, separately, below.
  useFocusEffect(
    useCallback(() => {
      if (!managedClubId) {
        setLoading(false);
        return;
      }
      let cancelled = false;
      setLoading(true);

      (async () => {
        const [clubRes, playersRes] = await Promise.all([
          supabase.from('clubs').select('*').eq('id', managedClubId).single(),
          supabase.from('players').select('*').eq('club_id', managedClubId),
        ]);
        if (cancelled) return;
        if (clubRes.error) setError(clubRes.error.message);
        else setClub(clubRes.data);
        if (playersRes.error) setError(playersRes.error.message);
        else setPlayers(playersRes.data ?? []);

        const playerIds = (playersRes.data ?? []).map((p) => p.id);
        if (seasonId && playerIds.length > 0) {
          const { data: statRows } = await supabase
            .from('player_match_stats')
            .select('*')
            .eq('season_id', seasonId)
            .in('player_id', playerIds);
          if (!cancelled) setStats(statRows ?? []);
        }
        setLoading(false);
      })();

      return () => {
        cancelled = true;
      };
    }, [managedClubId, seasonId])
  );

  // Once the squad is available, load a saved lineup if one exists, else
  // auto-pick a default. Deliberately keyed on the squad going from empty
  // to non-empty (not on every `players` identity change) -- this should
  // run once per mount, not re-run and clobber in-progress edits.
  useEffect(() => {
    if (players.length === 0 || !session) return;
    let cancelled = false;

    (async () => {
      const fallbackToAutoPick = () => {
        const key: FormationKey = '4-3-3';
        setFormationKey(key);
        setAssignment(autoPickBestXI(players, key));
        setExistingLineupId(null);
      };

      const { data: lineupRows, error: lineupError } = await supabase
        .from('lineups')
        .select('id, formation')
        .eq('profile_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (cancelled) return;
      if (lineupError || !lineupRows || lineupRows.length === 0) {
        fallbackToAutoPick();
        return;
      }

      const lineup = lineupRows[0];
      const { data: slotRows, error: slotError } = await supabase
        .from('lineup_slots')
        .select('slot_key, player_id')
        .eq('lineup_id', lineup.id);

      if (cancelled) return;
      if (slotError || !slotRows || slotRows.length === 0) {
        fallbackToAutoPick();
        return;
      }

      const restored: SlotAssignment = {};
      for (const row of slotRows) restored[row.slot_key] = row.player_id;
      setFormationKey(lineup.formation as FormationKey);
      setAssignment(restored);
      setExistingLineupId(lineup.id);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players.length > 0, session?.user.id]);

  const playersById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const bench = useMemo(() => benchPlayers(players, assignment), [players, assignment]);
  const avgRatingByPlayer = useMemo(() => {
    const rows = buildLeaderRows(stats, players);
    return new Map(rows.map((r) => [r.playerId, r.avgRating]));
  }, [stats, players]);

  const rating = useMemo(
    () => computeLineupRating(formationKey, assignment, playersById),
    [formationKey, assignment, playersById]
  );
  const slots = formations[formationKey];
  const selectedSlotGroup = selectedSlot ? slots.find((s) => s.key === selectedSlot)?.group ?? null : null;

  // Live preview: while a slot is selected and the user is hovering/
  // long-pressing a bench candidate, show what the club rating would
  // become if that swap were made -- before it's confirmed.
  const previewRating = useMemo(() => {
    if (!selectedSlot || !previewPlayerId) return null;
    const previewAssignment = { ...assignment, [selectedSlot]: previewPlayerId };
    const preview = computeLineupRating(formationKey, previewAssignment, playersById);
    return preview.overall > 0 ? preview.overall : null;
  }, [selectedSlot, previewPlayerId, assignment, formationKey, playersById]);

  // Delta from the previous saved XI -- so the cost of resting a tired star
  // (or any other swap) is immediately visible once it's actually applied.
  const previousOverallRef = useRef<number | null>(null);
  const [ratingDelta, setRatingDelta] = useState<number | null>(null);
  useEffect(() => {
    if (rating.overall <= 0) return;
    if (previousOverallRef.current != null && previousOverallRef.current !== rating.overall) {
      setRatingDelta(rating.overall - previousOverallRef.current);
    }
    previousOverallRef.current = rating.overall;
  }, [rating.overall]);

  const switchFormation = (key: FormationKey) => {
    setFormationKey(key);
    setAssignment(autoPickBestXI(players, key));
    setSelectedSlot(null);
    setRotationWarning(null);
  };

  const onAutoPickBest = () => {
    setAssignment(autoPickBestXI(players, formationKey));
    setSelectedSlot(null);
    setRotationWarning(null);
  };

  const onAutoPickRotation = () => {
    const result = autoPickRotationXI(players, formationKey);
    setAssignment(result.assignment);
    setSelectedSlot(null);
    setRotationWarning(result.warning);
  };

  const onTapSlot = (slotKey: string) => {
    setRotationWarning(null);
    if (selectedSlot === slotKey) {
      setSelectedSlot(null);
      return;
    }
    if (selectedSlot) {
      setAssignment((prev) => ({ ...prev, [selectedSlot]: prev[slotKey], [slotKey]: prev[selectedSlot] }));
      setSelectedSlot(null);
      return;
    }
    setSelectedSlot(slotKey);
  };

  const onTapBench = (playerId: string) => {
    if (!selectedSlot) return;
    setAssignment((prev) => ({ ...prev, [selectedSlot]: playerId }));
    setSelectedSlot(null);
    setPreviewPlayerId(null);
  };

  const isUnavailable = (player: Player): boolean => {
    const today = new Date().toISOString().slice(0, 10);
    const injured = player.injured_until != null && player.injured_until >= today;
    return injured || (player.suspended_matches ?? 0) > 0;
  };

  const visibleBench = useMemo(() => {
    let list = bench;
    if (benchPositionFilter) list = list.filter((p) => p.position === benchPositionFilter);
    if (freshOnly) list = list.filter((p) => p.fatigue_level === 'fresh');

    const sortValue = (p: Player): number => {
      switch (benchSortKey) {
        case 'effective':
          return effectiveOverall(p.overall ?? 0, p.fatigue_level ?? 'fresh');
        case 'overall':
          return p.overall ?? 0;
        case 'fatigue':
          return -(p.fatigue_points ?? 0); // freshest (lowest points) first
        case 'form':
          return p.form ?? 0;
        case 'rating':
          return avgRatingByPlayer.get(p.id) ?? 0;
        case 'position':
          return -POSITION_ORDER[p.position];
      }
    };

    const sorted = [...list].sort((a, b) => sortValue(b) - sortValue(a));

    if (!selectedSlotGroup) return sorted;
    // A slot is selected -- surface suited players first (same position
    // group), then everyone else, preserving the chosen sort within each.
    const suited = sorted.filter((p) => positionPenalty(selectedSlotGroup, p.position) === 0);
    const others = sorted.filter((p) => positionPenalty(selectedSlotGroup, p.position) !== 0);
    return [...suited, ...others];
  }, [bench, benchPositionFilter, freshOnly, benchSortKey, avgRatingByPlayer, selectedSlotGroup]);

  const saveLineup = async () => {
    if (!session) return;
    setSaving(true);
    setSaveMessage(null);

    try {
      let lineupId = existingLineupId;

      if (lineupId) {
        const { error: updateError } = await supabase
          .from('lineups')
          .update({ formation: formationKey })
          .eq('id', lineupId);
        if (updateError) throw updateError;
        const { error: deleteError } = await supabase.from('lineup_slots').delete().eq('lineup_id', lineupId);
        if (deleteError) throw deleteError;
      } else {
        const { data: created, error: insertError } = await supabase
          .from('lineups')
          .insert({ profile_id: session.user.id, formation: formationKey })
          .select('id')
          .single();
        if (insertError) throw insertError;
        lineupId = created.id;
        setExistingLineupId(lineupId);
      }

      const slotRows = Object.entries(assignment)
        .filter((entry): entry is [string, string] => entry[1] != null)
        .map(([slot_key, player_id]) => ({ lineup_id: lineupId, player_id, slot_key, is_starter: true }));

      const { error: slotsError } = await supabase.from('lineup_slots').insert(slotRows);
      if (slotsError) throw slotsError;

      if (managedClubId && rating.overall > 0) {
        await supabase.from('clubs').update({ current_rating: rating.overall }).eq('id', managedClubId);
      }

      setSaveMessage('Lineup saved.');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to save lineup.';
      setSaveMessage(
        message.includes('does not exist') || message.includes('schema cache')
          ? "Can't save yet — the lineups table hasn't been created (run migration 0007)."
          : message
      );
    } finally {
      setSaving(false);
    }
  };

  // --- sizing: pitch capped at 55%/60% viewport height (mobile/web), 520px wide max ---
  const pitchHeightCap = winHeight * (isWeb ? 0.6 : 0.55);
  const pitchWidthFromHeight = pitchHeightCap / (130 / 100);
  const pitchWidth = Math.max(200, Math.min(520, winWidth - spacing.lg * 2, pitchWidthFromHeight));
  const pitchHeight = pitchWidth * (130 / 100);
  const tokenSize = isWeb ? 52 : 44;

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator style={styles.spinner} color={baseColors.textSecondary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.topRow}>
          <View style={styles.topRowText}>
            <Text style={styles.eyebrow}>Lineup</Text>
            <Text style={styles.title} numberOfLines={1}>
              {club?.name ?? '—'}
            </Text>
          </View>
          <View style={styles.ratingBlock}>
            {previewRating != null ? (
              <View style={styles.previewRow}>
                <OverallBadge overall={rating.overall > 0 ? rating.overall : null} size="md" />
                <Text style={styles.previewArrow}>→</Text>
                <OverallBadge overall={previewRating} size="md" />
              </View>
            ) : (
              <OverallBadge overall={rating.overall > 0 ? rating.overall : null} size="lg" />
            )}
            {ratingDelta != null && ratingDelta !== 0 && previewRating == null && (
              <Text style={[styles.ratingDelta, { color: ratingDelta > 0 ? '#3ECF6B' : '#F2544C' }]}>
                {ratingDelta > 0 ? '▲' : '▼'}
                {Math.abs(ratingDelta)}
              </Text>
            )}
          </View>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.formationRow}>
          {FORMATION_KEYS.map((key) => (
            <PressableScale
              key={key}
              onPress={() => switchFormation(key)}
              style={[
                styles.formationChip,
                key === formationKey && { backgroundColor: theme.accent, borderColor: theme.accent },
              ]}>
              <Text style={[styles.formationChipText, key === formationKey && styles.formationChipTextActive]}>
                {key}
              </Text>
            </PressableScale>
          ))}
        </View>

        <View style={[styles.pitchWrapper, { width: pitchWidth, height: pitchHeight }]}>
          <Pitch primaryColour={club?.primary_colour} />
          {slots.map((slot) => {
            const playerId = assignment[slot.key];
            const player = playerId ? playersById.get(playerId) : undefined;
            return (
              <ShirtToken
                key={slot.key}
                slot={slot}
                player={player}
                selected={selectedSlot === slot.key}
                accent={theme.accent}
                tokenSize={tokenSize}
                onPress={() => onTapSlot(slot.key)}
              />
            );
          })}
        </View>

        <View style={styles.actionsRow}>
          <PressableScale style={styles.secondaryButtonSmall} onPress={onAutoPickBest}>
            <Text style={styles.secondaryButtonSmallText}>Best XI</Text>
          </PressableScale>
          <PressableScale style={styles.secondaryButtonSmall} onPress={onAutoPickRotation}>
            <Text style={styles.secondaryButtonSmallText}>Rotation</Text>
          </PressableScale>
          <PressableScale
            style={[styles.primaryButton, { backgroundColor: theme.accent }]}
            onPress={saveLineup}
            disabled={saving}>
            {saving ? (
              <ActivityIndicator color={baseColors.textInverse} />
            ) : (
              <Text style={styles.primaryButtonText}>Save</Text>
            )}
          </PressableScale>
        </View>
        {rotationWarning && <Text style={styles.warning}>{rotationWarning}</Text>}
        {saveMessage && <Text style={styles.saveMessage}>{saveMessage}</Text>}

        <View style={styles.benchSection}>
          <View style={styles.benchControls}>
            <Text style={styles.benchLabel}>
              Bench{selectedSlot ? ` — tap a player to fill ${selectedSlot}` : ''}
            </Text>
            <View style={styles.chipRow}>
              <FilterChip label="All" active={benchPositionFilter == null} onPress={() => setBenchPositionFilter(null)} />
              {POSITION_FILTERS.map((pos) => (
                <FilterChip
                  key={pos}
                  label={pos}
                  active={benchPositionFilter === pos}
                  onPress={() => setBenchPositionFilter(pos)}
                />
              ))}
              <FilterChip label="Fresh only" active={freshOnly} onPress={() => setFreshOnly((v) => !v)} />
            </View>
            <View style={styles.chipRow}>
              {BENCH_SORT_OPTIONS.map((opt) => (
                <FilterChip
                  key={opt.key}
                  label={opt.label}
                  active={benchSortKey === opt.key}
                  onPress={() => setBenchSortKey(opt.key)}
                />
              ))}
            </View>
          </View>

          <FlatList
            data={visibleBench}
            keyExtractor={(p) => p.id}
            contentContainerStyle={styles.benchList}
            style={styles.benchFlatList}
            renderItem={({ item }) => (
              <BenchRow
                player={item}
                avgRating={avgRatingByPlayer.get(item.id) ?? null}
                unavailable={isUnavailable(item)}
                selectable={selectedSlot != null}
                penalty={selectedSlotGroup ? positionPenalty(selectedSlotGroup, item.position) : 0}
                effective={
                  selectedSlotGroup ? adjustedOverall(item, selectedSlotGroup) : effectiveOverall(item.overall ?? 0, item.fatigue_level ?? 'fresh')
                }
                onPress={() => onTapBench(item.id)}
                onPreviewStart={() => selectedSlot && setPreviewPlayerId(item.id)}
                onPreviewEnd={() => setPreviewPlayerId((prev) => (prev === item.id ? null : prev))}
              />
            )}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </PressableScale>
  );
}

function BenchRow({
  player,
  avgRating,
  unavailable,
  selectable,
  penalty,
  effective,
  onPress,
  onPreviewStart,
  onPreviewEnd,
}: {
  player: Player;
  avgRating: number | null;
  unavailable: boolean;
  selectable: boolean;
  penalty: number;
  effective: number;
  onPress: () => void;
  onPreviewStart: () => void;
  onPreviewEnd: () => void;
}) {
  const disabled = unavailable || !selectable;

  return (
    <PressableScale
      style={[styles.benchRow, disabled && styles.benchRowInactive]}
      onPress={onPress}
      disabled={disabled}
      onPressIn={onPreviewStart}
      onPressOut={onPreviewEnd}
      onHoverIn={onPreviewStart}
      onHoverOut={onPreviewEnd}>
      <OverallBadge overall={player.overall} fatigueLevel={player.fatigue_level} size="sm" />
      <View style={styles.benchInfo}>
        <View style={styles.benchNameRow}>
          <FatigueDot level={player.fatigue_level} />
          <Text style={styles.benchName} numberOfLines={1}>
            {player.full_name}
          </Text>
          <PositionPill position={player.position} size="sm" />
        </View>
        <View style={styles.benchMetaRow}>
          <Text style={styles.benchMetaText}>{FATIGUE_LABEL[player.fatigue_level]}</Text>
          <Text style={styles.benchMetaDivider}>·</Text>
          <PlayerFormTrend rating={player.form} />
          {unavailable && (
            <Text style={styles.unavailableText}>
              {player.injured_until && player.injured_until >= new Date().toISOString().slice(0, 10) ? 'Injured' : 'Suspended'}
            </Text>
          )}
          {!unavailable && penalty !== 0 && <Text style={styles.penaltyText}>{penalty} out of position</Text>}
        </View>
      </View>
      <View style={styles.benchRight}>
        <Text style={styles.benchEffective}>Eff {effective}</Text>
        <Text style={styles.benchRating}>{avgRating != null ? avgRating.toFixed(1) : '—'} avg</Text>
      </View>
    </PressableScale>
  );
}

/** A player's own rolling `form` rating (0-10), rendered as a single small
 * colour-coded dot -- players don't have a per-match W/D/L history the way
 * clubs do (FormGuide), only this one rolling number, so this is a
 * deliberately simpler indicator, not a reuse of FormGuide. */
function PlayerFormTrend({ rating }: { rating: number | null }) {
  if (rating == null) return <Text style={styles.benchMetaText}>No form yet</Text>;
  const tier = rating >= 7 ? 'gold' : rating >= 5.5 ? 'bronze' : 'grey';
  const color = tier === 'gold' ? '#3ECF6B' : tier === 'bronze' ? '#F2A93B' : '#F2544C';
  return (
    <View style={styles.formDotRow} accessibilityLabel={`Form rating ${rating.toFixed(1)}`}>
      <View style={[styles.formDot, { backgroundColor: color }]} />
      <Text style={styles.benchMetaText}>{rating.toFixed(1)}</Text>
    </View>
  );
}

function Pitch({ primaryColour }: { primaryColour?: string | null }) {
  const base = primaryColour || baseColors.accentFallback;
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 130" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
      <Rect x={0} y={0} width={100} height={130} fill={base} opacity={0.16} />
      <Rect x={0} y={0} width={100} height={130} fill={baseColors.background} opacity={0.55} />
      <Rect x={2} y={2} width={96} height={126} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={0.6} />
      <Line x1={2} y1={65} x2={98} y2={65} stroke="rgba(255,255,255,0.3)" strokeWidth={0.6} />
      <Circle cx={50} cy={65} r={12} stroke="rgba(255,255,255,0.3)" strokeWidth={0.6} fill="none" />
      <Rect x={25} y={2} width={50} height={18} stroke="rgba(255,255,255,0.3)" strokeWidth={0.6} fill="none" />
      <Rect x={25} y={110} width={50} height={18} stroke="rgba(255,255,255,0.3)" strokeWidth={0.6} fill="none" />
    </Svg>
  );
}

function ShirtToken({
  slot,
  player,
  selected,
  accent,
  tokenSize,
  onPress,
}: {
  slot: FormationSlot;
  player: Player | undefined;
  selected: boolean;
  accent: string;
  tokenSize: number;
  onPress: () => void;
}) {
  const outOfPosition = player != null && player.position !== slot.group;
  const borderColor = selected ? '#FFFFFF' : outOfPosition ? '#F2C94C' : 'transparent';
  const wrapperWidth = tokenSize + 24;

  return (
    <View
      style={[
        styles.tokenWrapper,
        {
          left: `${slot.x}%`,
          top: `${100 - slot.y}%`,
          width: wrapperWidth,
          marginLeft: -wrapperWidth / 2,
          marginTop: -(tokenSize / 2 + 8),
        },
      ]}>
      <PressableScale
        onPress={onPress}
        style={[
          styles.token,
          { width: tokenSize, height: tokenSize, borderRadius: tokenSize / 2, backgroundColor: accent, borderColor },
        ]}>
        <Text style={[styles.tokenNumber, { fontSize: tokenSize * 0.38 }]}>
          {player ? shirtNumberFor(player.id) : '–'}
        </Text>
        {player && (
          <View style={styles.tokenFatigueDot}>
            <FatigueDot level={player.fatigue_level} size={Math.round(tokenSize * 0.2)} />
          </View>
        )}
      </PressableScale>
      <Text style={styles.tokenName} numberOfLines={1}>
        {player ? player.full_name.split(' ').slice(-1)[0] : slot.label}
      </Text>
      {player && <Text style={styles.tokenOverall}>{adjustedOverall(player, slot.group)}</Text>}
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
  spinner: {
    marginTop: spacing.xxl,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  topRowText: {
    flex: 1,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: baseColors.textTertiary,
  },
  title: {
    ...typography.displayLG,
    color: baseColors.textPrimary,
  },
  ratingBlock: {
    alignItems: 'center',
    gap: 2,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  previewArrow: {
    ...typography.bodyBold,
    color: baseColors.textSecondary,
  },
  ratingDelta: {
    fontSize: 12,
    fontWeight: '800',
  },
  error: {
    ...typography.body,
    color: '#F2544C',
    paddingHorizontal: spacing.lg,
  },
  formationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
  formationChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: baseColors.surfaceElevated,
    borderColor: baseColors.border,
  },
  formationChipText: {
    ...typography.caption,
    fontSize: 10,
    color: baseColors.textSecondary,
  },
  formationChipTextActive: {
    color: baseColors.textInverse,
  },
  pitchWrapper: {
    alignSelf: 'center',
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: baseColors.border,
    position: 'relative',
    marginTop: spacing.xs,
  },
  tokenWrapper: {
    position: 'absolute',
    alignItems: 'center',
    gap: 2,
  },
  token: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenFatigueDot: {
    position: 'absolute',
    top: -1,
    right: -1,
  },
  tokenNumber: {
    fontWeight: '800',
    color: baseColors.textInverse,
  },
  tokenName: {
    fontSize: 10,
    fontWeight: '700',
    color: baseColors.textPrimary,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  tokenOverall: {
    fontSize: 9,
    fontWeight: '800',
    color: baseColors.textSecondary,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
  secondaryButtonSmall: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: baseColors.borderStrong,
    alignItems: 'center',
  },
  secondaryButtonSmallText: {
    ...typography.caption,
    fontWeight: '800',
    color: baseColors.textPrimary,
  },
  primaryButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    ...typography.caption,
    fontWeight: '800',
    color: baseColors.textInverse,
  },
  warning: {
    ...typography.caption,
    color: '#F2A93B',
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: 4,
  },
  saveMessage: {
    ...typography.caption,
    color: baseColors.textSecondary,
    textAlign: 'center',
    paddingTop: 4,
  },
  benchSection: {
    flex: 1,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  benchControls: {
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  benchLabel: {
    ...typography.eyebrow,
    color: baseColors.textTertiary,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: baseColors.surfaceElevated,
    borderColor: baseColors.border,
  },
  chipActive: {
    backgroundColor: baseColors.surfacePressed,
    borderColor: baseColors.borderStrong,
  },
  chipText: {
    ...typography.caption,
    fontSize: 10,
    color: baseColors.textSecondary,
  },
  chipTextActive: {
    color: baseColors.textPrimary,
  },
  benchFlatList: {
    flex: 1,
  },
  benchList: {
    gap: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  benchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: baseColors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: baseColors.border,
    padding: spacing.md,
  },
  benchRowInactive: {
    opacity: 0.5,
  },
  benchInfo: {
    flex: 1,
    gap: 4,
  },
  benchNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  benchName: {
    ...typography.bodyBold,
    color: baseColors.textPrimary,
    flexShrink: 1,
  },
  benchMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  benchMetaText: {
    ...typography.caption,
    fontSize: 10,
    color: baseColors.textTertiary,
  },
  benchMetaDivider: {
    ...typography.caption,
    fontSize: 10,
    color: baseColors.textTertiary,
  },
  formDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  formDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  unavailableText: {
    ...typography.caption,
    fontSize: 10,
    color: '#F2544C',
  },
  penaltyText: {
    ...typography.caption,
    fontSize: 10,
    color: '#F2C94C',
  },
  benchRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  benchEffective: {
    ...typography.numericMD,
    fontSize: 13,
    color: baseColors.textPrimary,
  },
  benchRating: {
    ...typography.caption,
    fontSize: 10,
    color: baseColors.textTertiary,
  },
});
