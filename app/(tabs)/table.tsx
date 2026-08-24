import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth-context';
import { computeStandings, type StandingsRow } from '@/lib/standings';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/lib/use-profile';
import { baseColors, radius, spacing, typography } from '@/theme';
import type { Club, Fixture } from '@/types';

export default function TableScreen() {
  const { session } = useAuth();
  const { profile } = useProfile(session);

  const [clubs, setClubs] = useState<Club[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const managedClubId = profile?.managed_club_id ?? null;

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      supabase.from('clubs').select('*'),
      supabase.from('fixtures').select('*').eq('competition', 'league'),
    ]).then(([clubsRes, fixturesRes]) => {
      if (cancelled) return;
      if (clubsRes.error) setError(clubsRes.error.message);
      else setClubs(clubsRes.data ?? []);
      if (fixturesRes.error) setError(fixturesRes.error.message);
      setFixtures(fixturesRes.data ?? []);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const standings = useMemo(() => computeStandings(fixtures, clubs), [fixtures, clubs]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Ligat ha&apos;Al</Text>
          <Text style={styles.title}>Table</Text>
        </View>

        {loading && <ActivityIndicator style={styles.spinner} color={baseColors.textSecondary} />}
        {error && <Text style={styles.error}>{error}</Text>}

        {!loading && (
          <>
            <View style={styles.columnHeader}>
              <Text style={[styles.columnHeaderText, styles.colPos]}>#</Text>
              <Text style={[styles.columnHeaderText, styles.colClub]}>Club</Text>
              <Text style={[styles.columnHeaderText, styles.colStat]}>P</Text>
              <Text style={[styles.columnHeaderText, styles.colStat]}>W</Text>
              <Text style={[styles.columnHeaderText, styles.colStat]}>D</Text>
              <Text style={[styles.columnHeaderText, styles.colStat]}>L</Text>
              <Text style={[styles.columnHeaderText, styles.colStat]}>GF</Text>
              <Text style={[styles.columnHeaderText, styles.colStat]}>GA</Text>
              <Text style={[styles.columnHeaderText, styles.colStat]}>GD</Text>
              <Text style={[styles.columnHeaderText, styles.colPts]}>Pts</Text>
            </View>

            <FlatList
              data={standings}
              keyExtractor={(row) => row.club.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item, index }) => (
                <TableRow row={item} position={index + 1} highlighted={item.club.id === managedClubId} />
              )}
            />
          </>
        )}
      </SafeAreaView>
    </View>
  );
}

function TableRow({ row, position, highlighted }: { row: StandingsRow; position: number; highlighted: boolean }) {
  return (
    <View style={[styles.row, highlighted && styles.rowHighlighted]}>
      <Text style={[styles.cellText, styles.colPos]}>{position}</Text>
      <Text style={[styles.cellText, styles.colClub, highlighted && styles.cellTextHighlighted]} numberOfLines={1}>
        {row.club.short_name}
      </Text>
      <Text style={[styles.cellText, styles.colStat]}>{row.played}</Text>
      <Text style={[styles.cellText, styles.colStat]}>{row.won}</Text>
      <Text style={[styles.cellText, styles.colStat]}>{row.drawn}</Text>
      <Text style={[styles.cellText, styles.colStat]}>{row.lost}</Text>
      <Text style={[styles.cellText, styles.colStat]}>{row.goalsFor}</Text>
      <Text style={[styles.cellText, styles.colStat]}>{row.goalsAgainst}</Text>
      <Text style={[styles.cellText, styles.colStat]}>{row.goalDifference}</Text>
      <Text style={[styles.cellText, styles.colPts, styles.pts]}>{row.points}</Text>
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
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    marginBottom: spacing.md,
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
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: baseColors.border,
  },
  columnHeaderText: {
    ...typography.eyebrow,
    fontSize: 10,
    color: baseColors.textTertiary,
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: baseColors.border,
  },
  rowHighlighted: {
    backgroundColor: baseColors.surfaceElevated,
  },
  cellText: {
    ...typography.caption,
    color: baseColors.textSecondary,
    textAlign: 'center',
  },
  cellTextHighlighted: {
    color: baseColors.textPrimary,
    fontWeight: '800',
  },
  colPos: {
    width: 24,
    textAlign: 'left',
  },
  colClub: {
    flex: 1,
    textAlign: 'left',
  },
  colStat: {
    width: 26,
  },
  colPts: {
    width: 32,
  },
  pts: {
    ...typography.numericMD,
    fontSize: 13,
    color: baseColors.textPrimary,
  },
});
