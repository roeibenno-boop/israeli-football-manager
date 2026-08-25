import { StyleSheet, Text, View } from 'react-native';

import { ClubCrest } from '@/components/ClubCrest';
import { PressableScale } from '@/components/PressableScale';
import { bestAverageRating, mostCleanSheets, type LeaderRow } from '@/lib/leaders';
import { baseColors, radius, spacing, typography } from '@/theme';
import type { Club, PlayerPosition } from '@/types';

const MIN_APPS = 5;
const POSITION_FILTERS: Array<PlayerPosition | 'ALL'> = ['ALL', 'GK', 'DF', 'MF', 'FW'];

type RatingLeadersTabProps = {
  rows: LeaderRow[];
  positionFilter: PlayerPosition | 'ALL';
  onPositionFilterChange: (position: PlayerPosition | 'ALL') => void;
  clubsById: Map<string, Club>;
  onSelectPlayer: (playerId: string) => void;
};

/** Ranked by average match rating (min 5 apps), plus a standalone GK-of-the-season card. */
export function RatingLeadersTab({ rows, positionFilter, onPositionFilterChange, clubsById, onSelectPlayer }: RatingLeadersTabProps) {
  const eligible = bestAverageRating(rows, 999);
  const filtered = positionFilter === 'ALL' ? eligible : eligible.filter((r) => r.position === positionFilter);

  const gkOfSeason = mostCleanSheets(bestAverageRating(rows, 999), 1)[0] ?? null;
  const gkTotalShots = gkOfSeason ? gkOfSeason.saves + gkOfSeason.goalsConceded : 0;
  const gkSavePct = gkTotalShots > 0 ? Math.round((gkOfSeason!.saves / gkTotalShots) * 100) : null;

  return (
    <View style={styles.container}>
      <Text style={styles.minNote}>Ranked by average match rating · minimum {MIN_APPS} appearances</Text>

      {gkOfSeason && (
        <View style={styles.gkCard}>
          <Text style={styles.gkEyebrow}>Goalkeeper of the Season</Text>
          <View style={styles.gkRow}>
            <ClubCrest
              primaryColour={clubsById.get(gkOfSeason.clubId)?.primary_colour}
              secondaryColour={clubsById.get(gkOfSeason.clubId)?.secondary_colour}
              initials={clubsById.get(gkOfSeason.clubId)?.crest_initials}
              logoUrl={clubsById.get(gkOfSeason.clubId)?.logo_url}
              fallbackName={clubsById.get(gkOfSeason.clubId)?.short_name}
              size="md"
            />
            <View style={styles.gkInfo}>
              <Text style={styles.gkName} numberOfLines={1}>
                {gkOfSeason.fullName}
              </Text>
              <Text style={styles.gkMeta}>
                {gkOfSeason.cleanSheets} clean sheets · {gkSavePct != null ? `${gkSavePct}% saves` : '— saves'}
              </Text>
            </View>
            <Text style={styles.gkRating}>{gkOfSeason.avgRating.toFixed(1)}</Text>
          </View>
        </View>
      )}

      <View style={styles.chipRow}>
        {POSITION_FILTERS.map((pos) => (
          <PressableScale
            key={pos}
            style={[styles.chip, positionFilter === pos && styles.chipActive]}
            onPress={() => onPositionFilterChange(pos)}>
            <Text style={[styles.chipText, positionFilter === pos && styles.chipTextActive]}>{pos}</Text>
          </PressableScale>
        ))}
      </View>

      {filtered.length === 0 ? (
        <Text style={styles.empty}>
          Nobody{positionFilter !== 'ALL' ? ` at ${positionFilter}` : ''} has {MIN_APPS}+ appearances yet.
        </Text>
      ) : (
        <View style={styles.list}>
          {filtered.map((row, index) => (
            <View key={row.playerId} style={styles.row}>
              <PressableScale style={styles.rowPressable} onPress={() => onSelectPlayer(row.playerId)}>
                <Text style={styles.rank}>{index + 1}</Text>
                <Text style={styles.name} numberOfLines={1}>
                  {row.fullName}
                </Text>
                <ClubCrest
                  primaryColour={clubsById.get(row.clubId)?.primary_colour}
                  secondaryColour={clubsById.get(row.clubId)?.secondary_colour}
                  initials={clubsById.get(row.clubId)?.crest_initials}
                  logoUrl={clubsById.get(row.clubId)?.logo_url}
                  fallbackName={clubsById.get(row.clubId)?.short_name}
                  size="sm"
                />
                <Text style={styles.apps}>{row.apps} apps</Text>
                <Text style={styles.motm}>{row.motm} MOTM</Text>
                <Text style={styles.rating}>{row.avgRating.toFixed(1)}</Text>
              </PressableScale>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  minNote: {
    ...typography.caption,
    color: baseColors.textTertiary,
  },
  gkCard: {
    backgroundColor: baseColors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: baseColors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  gkEyebrow: {
    ...typography.eyebrow,
    color: baseColors.textTertiary,
  },
  gkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  gkInfo: { flex: 1, gap: 2 },
  gkName: {
    ...typography.bodyBold,
    color: baseColors.textPrimary,
  },
  gkMeta: {
    ...typography.caption,
    color: baseColors.textSecondary,
  },
  gkRating: {
    ...typography.numericLG,
    color: '#F2C94C',
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
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
    color: baseColors.textSecondary,
  },
  chipTextActive: {
    color: baseColors.textPrimary,
  },
  empty: {
    ...typography.body,
    color: baseColors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  list: { gap: spacing.xs },
  row: {
    backgroundColor: baseColors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: baseColors.border,
  },
  rowPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  rank: {
    ...typography.numericMD,
    color: baseColors.textTertiary,
    width: 22,
    textAlign: 'center',
  },
  name: {
    ...typography.bodyBold,
    color: baseColors.textPrimary,
    flex: 1,
  },
  apps: {
    ...typography.caption,
    color: baseColors.textTertiary,
    width: 52,
  },
  motm: {
    ...typography.caption,
    color: baseColors.textTertiary,
    width: 56,
  },
  rating: {
    ...typography.numericMD,
    color: baseColors.textPrimary,
    width: 36,
    textAlign: 'right',
  },
});
