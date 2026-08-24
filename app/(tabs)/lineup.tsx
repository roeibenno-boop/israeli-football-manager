import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Rect } from 'react-native-svg';

import { OverallBadge } from '@/components/OverallBadge';
import { PositionPill } from '@/components/PositionPill';
import { PressableScale } from '@/components/PressableScale';
import { useAuth } from '@/lib/auth-context';
import { FORMATION_KEYS, formations, type FormationKey, type FormationSlot } from '@/lib/formations';
import { adjustedOverall, autoPickBestXI, benchPlayers, computeLineupRating, shirtNumberFor, type SlotAssignment } from '@/lib/lineup';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/lib/use-profile';
import { baseColors, radius, spacing, typography, useClubTheme } from '@/theme';
import type { Club, Player } from '@/types';

export default function LineupScreen() {
  const { session } = useAuth();
  const { profile } = useProfile(session);
  const theme = useClubTheme();

  const [club, setClub] = useState<Club | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formationKey, setFormationKey] = useState<FormationKey>('4-3-3');
  const [assignment, setAssignment] = useState<SlotAssignment>({});
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [existingLineupId, setExistingLineupId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const managedClubId = profile?.managed_club_id ?? null;

  // Load club + squad.
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
      // lineupError here commonly means 0007_tactics.sql hasn't been run
      // yet (relation doesn't exist) -- degrade gracefully either way.
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
  const rating = useMemo(
    () => computeLineupRating(formationKey, assignment, playersById),
    [formationKey, assignment, playersById]
  );
  const slots = formations[formationKey];

  const switchFormation = (key: FormationKey) => {
    setFormationKey(key);
    setAssignment(autoPickBestXI(players, key));
    setSelectedSlot(null);
  };

  const onAutoPick = () => {
    setAssignment(autoPickBestXI(players, formationKey));
    setSelectedSlot(null);
  };

  const onTapSlot = (slotKey: string) => {
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
  };

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
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.topRow}>
            <View style={styles.topRowText}>
              <Text style={styles.eyebrow}>Lineup</Text>
              <Text style={styles.title} numberOfLines={1}>
                {club?.name ?? '—'}
              </Text>
            </View>
            <OverallBadge overall={rating.overall > 0 ? rating.overall : null} size="lg" />
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

          <View style={styles.pitchWrapper}>
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
                  onPress={() => onTapSlot(slot.key)}
                />
              );
            })}
          </View>

          <View style={styles.actionsRow}>
            <PressableScale style={styles.secondaryButton} onPress={onAutoPick}>
              <Text style={styles.secondaryButtonText}>Auto-Pick Best XI</Text>
            </PressableScale>
            <PressableScale
              style={[styles.primaryButton, { backgroundColor: theme.accent }]}
              onPress={saveLineup}
              disabled={saving}>
              {saving ? (
                <ActivityIndicator color={baseColors.textInverse} />
              ) : (
                <Text style={styles.primaryButtonText}>Save Lineup</Text>
              )}
            </PressableScale>
          </View>
          {saveMessage && <Text style={styles.saveMessage}>{saveMessage}</Text>}

          <Text style={styles.benchLabel}>
            Bench{selectedSlot ? ` — tap a player to fill ${selectedSlot}` : ''}
          </Text>
          <View style={styles.benchList}>
            {bench.map((player) => (
              <PressableScale
                key={player.id}
                style={[styles.benchRow, !selectedSlot && styles.benchRowInactive]}
                onPress={() => onTapBench(player.id)}
                disabled={!selectedSlot}>
                <OverallBadge overall={player.overall} size="sm" />
                <View style={styles.benchInfo}>
                  <Text style={styles.benchName} numberOfLines={1}>
                    {player.full_name}
                  </Text>
                  <PositionPill position={player.position} size="sm" />
                </View>
              </PressableScale>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
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
  onPress,
}: {
  slot: FormationSlot;
  player: Player | undefined;
  selected: boolean;
  accent: string;
  onPress: () => void;
}) {
  const outOfPosition = player != null && player.position !== slot.group;
  const borderColor = selected ? '#FFFFFF' : outOfPosition ? '#F2C94C' : 'transparent';

  return (
    <View style={[styles.tokenWrapper, { left: `${slot.x}%`, top: `${100 - slot.y}%` }]}>
      <PressableScale onPress={onPress} style={[styles.token, { backgroundColor: accent, borderColor }]}>
        <Text style={styles.tokenNumber}>{player ? shirtNumberFor(player.id) : '–'}</Text>
      </PressableScale>
      <Text style={styles.tokenName} numberOfLines={1}>
        {player ? player.full_name.split(' ').slice(-1)[0] : slot.label}
      </Text>
      {player && (
        <Text style={styles.tokenOverall}>{adjustedOverall(player, slot.group)}</Text>
      )}
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
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
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
  error: {
    ...typography.body,
    color: '#F2544C',
  },
  formationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  formationChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: baseColors.surfaceElevated,
    borderColor: baseColors.border,
  },
  formationChipText: {
    ...typography.caption,
    color: baseColors.textSecondary,
  },
  formationChipTextActive: {
    color: baseColors.textInverse,
  },
  pitchWrapper: {
    aspectRatio: 100 / 130,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: baseColors.border,
    position: 'relative',
  },
  tokenWrapper: {
    position: 'absolute',
    width: 56,
    marginLeft: -28,
    marginTop: -22,
    alignItems: 'center',
    gap: 2,
  },
  token: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenNumber: {
    fontSize: 14,
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
    gap: spacing.sm,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: baseColors.borderStrong,
    alignItems: 'center',
  },
  secondaryButtonText: {
    ...typography.bodyBold,
    color: baseColors.textPrimary,
  },
  primaryButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    ...typography.bodyBold,
    color: baseColors.textInverse,
  },
  saveMessage: {
    ...typography.caption,
    color: baseColors.textSecondary,
    textAlign: 'center',
  },
  benchLabel: {
    ...typography.eyebrow,
    color: baseColors.textTertiary,
  },
  benchList: {
    gap: spacing.sm,
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
    opacity: 0.6,
  },
  benchInfo: {
    flex: 1,
    gap: 4,
  },
  benchName: {
    ...typography.bodyBold,
    color: baseColors.textPrimary,
  },
});
