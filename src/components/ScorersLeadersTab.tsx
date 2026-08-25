import { StyleSheet, Text, View } from 'react-native';

import { ClubCrest } from '@/components/ClubCrest';
import { PressableScale } from '@/components/PressableScale';
import type { LeaderRow } from '@/lib/leaders';
import { baseColors, radius, spacing, typography } from '@/theme';
import type { Club } from '@/types';

type Mode = 'goals' | 'assists';

type ScorersLeadersTabProps = {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  rows: LeaderRow[];
  clubsById: Map<string, Club>;
  managedClubId: string | null;
  onSelectPlayer: (playerId: string) => void;
};

const MEDAL_COLORS = ['#F2C94C', '#C9CDD6', '#C98A4C']; // gold / silver / bronze -- theme's tierColors palette

/** Season top scorers / top assisters, with a Goals/Assists segmented toggle. */
export function ScorersLeadersTab({ mode, onModeChange, rows, clubsById, managedClubId, onSelectPlayer }: ScorersLeadersTabProps) {
  const sorted = [...rows]
    .filter((r) => (mode === 'goals' ? r.goals > 0 : r.assists > 0))
    .sort((a, b) => (mode === 'goals' ? b.goals - a.goals : b.assists - a.assists));

  return (
    <View style={styles.container}>
      <View style={styles.segmentRow}>
        <SegmentButton label="Goals" active={mode === 'goals'} onPress={() => onModeChange('goals')} />
        <SegmentButton label="Assists" active={mode === 'assists'} onPress={() => onModeChange('assists')} />
      </View>

      {sorted.length === 0 ? (
        <Text style={styles.empty}>No {mode} recorded yet this season.</Text>
      ) : (
        <View style={styles.list}>
          {sorted.map((row, index) => (
            <LeaderRowItem
              key={row.playerId}
              rank={index + 1}
              row={row}
              mode={mode}
              club={clubsById.get(row.clubId)}
              isOwnClub={row.clubId === managedClubId}
              onPress={() => onSelectPlayer(row.playerId)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function SegmentButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <PressableScale style={[styles.segmentButton, active && styles.segmentButtonActive]} onPress={onPress}>
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </PressableScale>
  );
}

function LeaderRowItem({
  rank,
  row,
  mode,
  club,
  isOwnClub,
  onPress,
}: {
  rank: number;
  row: LeaderRow;
  mode: Mode;
  club: Club | undefined;
  isOwnClub: boolean;
  onPress: () => void;
}) {
  const podium = rank <= 3;
  const tally = mode === 'goals' ? row.goals : row.assists;
  const per90 = row.minutes > 0 ? ((row.goals / row.minutes) * 90).toFixed(2) : '0.00';
  const secondaryLine =
    mode === 'goals' ? `${per90} / 90 · ${row.penaltiesScored} pens` : `${row.keyPasses} key passes`;

  return (
    <PressableScale
      style={[
        styles.row,
        podium && styles.rowPodium,
        isOwnClub && styles.rowOwnClub,
        podium && { borderColor: MEDAL_COLORS[rank - 1] },
      ]}
      onPress={onPress}>
      <Text style={[styles.rank, podium && { color: MEDAL_COLORS[rank - 1] }]}>{rank}</Text>
      <View style={[styles.avatar, podium && { borderColor: MEDAL_COLORS[rank - 1] }]}>
        <Text style={styles.avatarText}>{initials(row.fullName)}</Text>
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, podium && styles.namePodium]} numberOfLines={1}>
          {row.fullName}
          {isOwnClub && <Text style={styles.ownClubTag}>  YOUR CLUB</Text>}
        </Text>
        <View style={styles.clubRow}>
          <ClubCrest
            primaryColour={club?.primary_colour}
            secondaryColour={club?.secondary_colour}
            initials={club?.crest_initials}
            logoUrl={club?.logo_url}
            fallbackName={club?.short_name}
            size="sm"
          />
          <Text style={styles.clubName} numberOfLines={1}>
            {club?.name ?? '—'}
          </Text>
        </View>
        <Text style={styles.secondary}>{secondaryLine}</Text>
      </View>
      <Text style={[styles.tally, podium && styles.tallyPodium]}>{tally}</Text>
    </PressableScale>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2 ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase() : name.slice(0, 2).toUpperCase();
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: baseColors.surfaceElevated,
    borderRadius: radius.pill,
    padding: 3,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  segmentButtonActive: {
    backgroundColor: baseColors.surfacePressed,
  },
  segmentText: {
    ...typography.bodyBold,
    color: baseColors.textTertiary,
  },
  segmentTextActive: {
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: baseColors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: baseColors.border,
    padding: spacing.md,
  },
  rowPodium: {
    padding: spacing.lg,
    backgroundColor: baseColors.surfaceElevated,
  },
  rowOwnClub: {
    borderColor: baseColors.borderStrong,
  },
  rank: {
    ...typography.numericMD,
    color: baseColors.textTertiary,
    width: 22,
    textAlign: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: baseColors.surfaceElevated,
    borderWidth: 1,
    borderColor: baseColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.caption,
    color: baseColors.textSecondary,
  },
  info: { flex: 1, gap: 3 },
  name: {
    ...typography.bodyBold,
    color: baseColors.textPrimary,
  },
  namePodium: {
    fontSize: 17,
  },
  ownClubTag: {
    ...typography.eyebrow,
    fontSize: 9,
    color: baseColors.accentFallback,
  },
  clubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  clubName: {
    ...typography.caption,
    color: baseColors.textSecondary,
    flexShrink: 1,
  },
  secondary: {
    ...typography.caption,
    fontSize: 11,
    color: baseColors.textTertiary,
  },
  tally: {
    ...typography.numericLG,
    color: baseColors.textPrimary,
  },
  tallyPodium: {
    fontSize: 28,
  },
});
