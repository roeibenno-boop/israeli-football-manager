import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/PressableScale';
import { useAuth } from '@/lib/auth-context';
import { archiveSeason, setProfileSeason, wipeSeasonRecord } from '@/lib/season-actions';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/lib/use-profile';
import { baseColors, radius, spacing, typography } from '@/theme';
import type { Club, Season } from '@/types';

export default function SettingsScreen() {
  const { session } = useAuth();
  const { profile, refresh: refreshProfile } = useProfile(session);

  const [season, setSeason] = useState<Season | null>(null);
  const [club, setClub] = useState<Club | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.current_season_id) return;
    let cancelled = false;

    Promise.all([
      supabase.from('seasons').select('*').eq('id', profile.current_season_id).single(),
      profile.managed_club_id
        ? supabase.from('clubs').select('*').eq('id', profile.managed_club_id).single()
        : Promise.resolve({ data: null }),
    ]).then(([seasonRes, clubRes]) => {
      if (cancelled) return;
      setSeason(seasonRes.data ?? null);
      setClub(clubRes.data ?? null);
    });

    return () => {
      cancelled = true;
    };
  }, [profile?.current_season_id, profile?.managed_club_id]);

  const restartSeason = async () => {
    if (!session || !profile?.current_season_id) return;
    setConfirmOpen(false);
    setRestarting(true);
    setError(null);

    try {
      await archiveSeason({ seasonId: profile.current_season_id, finalPosition: null, finalPoints: null });
      await wipeSeasonRecord(profile.current_season_id);
      await setProfileSeason(session.user.id, null, null);
      await refreshProfile();
      router.replace('/pick-club?mode=restart');
    } catch (e) {
      setRestarting(false);
      setError(e instanceof Error ? e.message : 'Failed to restart the season.');
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
          <Text style={styles.eyebrow}>Settings</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.content}>
          <Text style={styles.sectionLabel}>Current Season</Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              Season {season?.season_number ?? '—'} · {club?.name ?? '—'}
            </Text>
            <Text style={styles.cardSubtitle}>
              Started {season?.started_at ? new Date(season.started_at).toLocaleDateString() : '—'}
            </Text>
          </View>

          <Text style={styles.sectionLabel}>Danger Zone</Text>
          <View style={[styles.card, styles.dangerCard]}>
            <Text style={styles.dangerTitle}>Restart Season</Text>
            <Text style={styles.dangerBody}>
              Wipes every fixture, match stat, and standing for this season, and sends you back to
              club selection to start over — including the choice of who to manage. Your past
              seasons' history is unaffected.
            </Text>
            <PressableScale
              style={styles.dangerButton}
              onPress={() => setConfirmOpen(true)}
              disabled={restarting || !profile?.current_season_id}>
              {restarting ? (
                <ActivityIndicator color="#F2544C" />
              ) : (
                <Text style={styles.dangerButtonText}>Restart Season…</Text>
              )}
            </PressableScale>
            {error && <Text style={styles.error}>{error}</Text>}
          </View>
        </View>

        {confirmOpen && (
          <View style={styles.overlay}>
            <View style={styles.dialog}>
              <Text style={styles.dialogTitle}>Restart this season?</Text>
              <Text style={styles.dialogBody}>
                This permanently deletes all fixtures, match stats, and standings for the current
                season, and resets every player's fatigue, form, and injuries league-wide. You'll
                pick a club again from scratch. This cannot be undone.
              </Text>
              <View style={styles.dialogActions}>
                <PressableScale style={styles.dialogCancel} onPress={() => setConfirmOpen(false)}>
                  <Text style={styles.dialogCancelText}>Cancel</Text>
                </PressableScale>
                <PressableScale style={styles.dialogConfirm} onPress={restartSeason}>
                  <Text style={styles.dialogConfirmText}>Restart Season</Text>
                </PressableScale>
              </View>
            </View>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
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
  content: { padding: spacing.lg, gap: spacing.sm },
  sectionLabel: { ...typography.eyebrow, color: baseColors.textTertiary, marginTop: spacing.md },
  card: {
    backgroundColor: baseColors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: baseColors.border,
    padding: spacing.md,
    gap: 4,
  },
  cardTitle: { ...typography.bodyBold, color: baseColors.textPrimary },
  cardSubtitle: { ...typography.caption, color: baseColors.textTertiary },
  dangerCard: {
    borderColor: 'rgba(242,84,76,0.35)',
    gap: spacing.sm,
  },
  dangerTitle: { ...typography.bodyBold, color: '#F2544C' },
  dangerBody: { ...typography.caption, color: baseColors.textSecondary, lineHeight: 18 },
  dangerButton: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#F2544C',
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  dangerButtonText: { ...typography.bodyBold, color: '#F2544C' },
  error: { ...typography.caption, color: '#F2544C' },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(11,11,13,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  dialog: {
    backgroundColor: baseColors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: baseColors.borderStrong,
    padding: spacing.lg,
    gap: spacing.md,
    maxWidth: 420,
    width: '100%',
  },
  dialogTitle: { ...typography.displayLG, color: baseColors.textPrimary },
  dialogBody: { ...typography.body, color: baseColors.textSecondary, lineHeight: 20 },
  dialogActions: { flexDirection: 'row', gap: spacing.sm },
  dialogCancel: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: baseColors.borderStrong,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  dialogCancelText: { ...typography.bodyBold, color: baseColors.textPrimary },
  dialogConfirm: {
    flex: 1,
    borderRadius: radius.md,
    backgroundColor: '#F2544C',
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  dialogConfirmText: { ...typography.bodyBold, color: '#FFFFFF' },
});
