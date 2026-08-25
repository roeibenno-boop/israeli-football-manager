import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ClubCrest } from '@/components/ClubCrest';
import { FormGuide, MomentumLabel } from '@/components/FormGuide';
import { OverallBadge } from '@/components/OverallBadge';
import { PositionPill } from '@/components/PositionPill';
import { useAuth } from '@/lib/auth-context';
import { computeStandings } from '@/lib/standings';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/lib/use-profile';
import { baseColors, radius, spacing, typography } from '@/theme';
import type { Club, Fixture, Player, PlayerPosition } from '@/types';

const POSITION_ORDER: PlayerPosition[] = ['GK', 'DF', 'MF', 'FW'];
const POSITION_LABEL: Record<PlayerPosition, string> = {
  GK: 'Goalkeepers',
  DF: 'Defenders',
  MF: 'Midfielders',
  FW: 'Forwards',
};

/** Read-only club page -- opened via "View club" from the League Table tab. */
export default function ClubPageScreen() {
  const { clubId } = useLocalSearchParams<{ clubId: string }>();
  const { session } = useAuth();
  const { profile } = useProfile(session);
  const seasonId = profile?.current_season_id ?? null;

  const [club, setClub] = useState<Club | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clubId) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      const [clubRes, playersRes, clubsRes, fixturesRes] = await Promise.all([
        supabase.from('clubs').select('*').eq('id', clubId).single(),
        supabase.from('players').select('*').eq('club_id', clubId),
        supabase.from('clubs').select('*'),
        seasonId
          ? supabase.from('fixtures').select('*').eq('season_id', seasonId).eq('competition', 'league')
          : Promise.resolve({ data: [] }),
      ]);
      if (cancelled) return;
      setClub(clubRes.data ?? null);
      setPlayers(playersRes.data ?? []);
      setClubs(clubsRes.data ?? []);
      setFixtures(fixturesRes.data ?? []);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [clubId, seasonId]);

  const standings = useMemo(() => computeStandings(fixtures, clubs), [fixtures, clubs]);
  const position = useMemo(() => {
    const index = standings.findIndex((r) => r.club.id === clubId);
    return index >= 0 ? index + 1 : null;
  }, [standings, clubId]);
  const row = standings.find((r) => r.club.id === clubId);

  const groupedSquad = useMemo(() => {
    const groups = new Map<PlayerPosition, Player[]>();
    for (const pos of POSITION_ORDER) groups.set(pos, []);
    for (const p of players) groups.get(p.position)?.push(p);
    for (const list of groups.values()) list.sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0));
    return groups;
  }, [players]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
          <Text style={styles.eyebrow}>Club</Text>
          <View style={{ width: 40 }} />
        </View>

        {loading && <ActivityIndicator style={styles.spinner} color={baseColors.textSecondary} />}

        {!loading && club && (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
              <ClubCrest
                primaryColour={club.primary_colour}
                secondaryColour={club.secondary_colour}
                initials={club.crest_initials}
                logoUrl={club.logo_url}
                fallbackName={club.short_name}
                size="lg"
              />
              <Text style={styles.clubName}>{club.name}</Text>
              <View style={styles.metaRow}>
                {position != null && <Text style={styles.metaText}>{position}{ordinalSuffix(position)} · {row?.points ?? 0} pts</Text>}
                <OverallBadge overall={club.current_rating} size="md" />
                <MomentumLabel momentum={club.momentum} />
              </View>
              <FormGuide formString={club.form_string} />
            </View>

            {POSITION_ORDER.map((pos) => {
              const list = groupedSquad.get(pos) ?? [];
              if (list.length === 0) return null;
              return (
                <View key={pos} style={styles.section}>
                  <Text style={styles.sectionLabel}>{POSITION_LABEL[pos]}</Text>
                  {list.map((p) => (
                    <View key={p.id} style={styles.playerRow}>
                      <OverallBadge overall={p.overall} fatigueLevel={p.fatigue_level} size="sm" />
                      <Text style={styles.playerName} numberOfLines={1}>
                        {p.full_name}
                      </Text>
                      <PositionPill position={p.position} size="sm" />
                      <Text style={styles.playerAge}>{p.age ?? '—'}</Text>
                    </View>
                  ))}
                </View>
              );
            })}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

function ordinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0];
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: baseColors.background },
  safeArea: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  closeText: { ...typography.body, color: baseColors.textSecondary, width: 40 },
  eyebrow: { ...typography.eyebrow, color: baseColors.textTertiary },
  spinner: { marginTop: spacing.xxl },
  scrollContent: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  header: { alignItems: 'center', gap: spacing.sm },
  clubName: { ...typography.displayLG, color: baseColors.textPrimary, textAlign: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  metaText: { ...typography.body, color: baseColors.textSecondary },
  section: { gap: spacing.xs },
  sectionLabel: { ...typography.eyebrow, color: baseColors.textTertiary },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: baseColors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: baseColors.border,
    padding: spacing.sm,
  },
  playerName: { ...typography.bodyBold, color: baseColors.textPrimary, flex: 1 },
  playerAge: { ...typography.caption, color: baseColors.textTertiary, width: 24, textAlign: 'right' },
});
