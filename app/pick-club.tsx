import { Redirect, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ClubCrest } from '@/components/ClubCrest';
import { OverallBadge } from '@/components/OverallBadge';
import { PressableScale } from '@/components/PressableScale';
import { useAuth } from '@/lib/auth-context';
import { computeClubRating, type RatedPlayer } from '@/lib/ratings';
import { supabase } from '@/lib/supabase';
import { baseColors, radius, spacing, typography } from '@/theme';
import { useProfile } from '@/lib/use-profile';
import type { Club } from '@/types';

export default function PickClubScreen() {
  const { session, loading: sessionLoading } = useAuth();
  const { profile, loading: profileLoading, refresh } = useProfile(session);

  const [clubs, setClubs] = useState<Club[]>([]);
  const [ratingsByClub, setRatingsByClub] = useState<Record<string, number | null>>({});
  const [loadingClubs, setLoadingClubs] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      supabase.from('clubs').select('*').order('name', { ascending: true }),
      supabase.from('players').select('club_id, position, overall'),
    ]).then(([clubsRes, playersRes]) => {
      if (cancelled) return;

      if (clubsRes.error) {
        setError(clubsRes.error.message);
        setLoadingClubs(false);
        return;
      }
      setClubs(clubsRes.data ?? []);

      const byClub: Record<string, RatedPlayer[]> = {};
      for (const p of playersRes.data ?? []) {
        if (p.overall == null) continue;
        (byClub[p.club_id] ??= []).push({ position: p.position, overall: p.overall });
      }
      const ratings: Record<string, number | null> = {};
      for (const club of clubsRes.data ?? []) {
        const squad = byClub[club.id];
        ratings[club.id] = squad && squad.length > 0 ? computeClubRating(squad).overall : null;
      }
      setRatingsByClub(ratings);
      setLoadingClubs(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!sessionLoading && !session) {
    return <Redirect href="/sign-in" />;
  }
  if (!profileLoading && profile?.managed_club_id) {
    return <Redirect href="/" />;
  }

  const claim = async (club: Club) => {
    if (!session) return;
    setClaimingId(club.id);
    setError(null);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ managed_club_id: club.id })
      .eq('id', session.user.id);

    if (updateError) {
      setClaimingId(null);
      setError(updateError.message);
      return;
    }

    await refresh();
    router.replace('/');
  };

  const busy = sessionLoading || profileLoading || loadingClubs;

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Text style={styles.eyebrow}>Israeli Football Manager</Text>
        <Text style={styles.title}>Choose Your Club</Text>
        <Text style={styles.subtitle}>
          Every club here is currently unmanaged — picking one is permanent for now, there's no
          "switch club" screen yet.
        </Text>

        {busy && <ActivityIndicator style={styles.spinner} color={baseColors.textSecondary} />}
        {error && <Text style={styles.error}>{error}</Text>}

        <FlatList
          data={clubs}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => (
            <ClubCard
              club={item}
              overall={ratingsByClub[item.id] ?? null}
              index={index}
              claiming={claimingId === item.id}
              disabled={claimingId !== null}
              onPress={() => claim(item)}
            />
          )}
        />
      </SafeAreaView>
    </View>
  );
}

type ClubCardProps = {
  club: Club;
  overall: number | null;
  index: number;
  claiming: boolean;
  disabled: boolean;
  onPress: () => void;
};

function ClubCard({ club, overall, index, claiming, disabled, onPress }: ClubCardProps) {
  return (
    <Animated.View entering={FadeInDown.duration(300).delay(Math.min(index, 10) * 40)} style={styles.cardWrapper}>
      <PressableScale
        style={[styles.card, disabled && !claiming && styles.cardDisabled]}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`Manage ${club.name}`}>
        <ClubCrest
          primaryColour={club.primary_colour}
          secondaryColour={club.secondary_colour}
          initials={club.crest_initials}
          logoUrl={club.logo_url}
          fallbackName={club.short_name}
          size="lg"
        />
        <Text style={styles.cardName} numberOfLines={2}>
          {club.name}
        </Text>
        <View style={styles.cardFooter}>
          <Text style={styles.cardLeague} numberOfLines={1}>
            {club.league}
          </Text>
          <OverallBadge overall={overall} size="sm" />
        </View>
        {claiming && (
          <View style={styles.claimingOverlay}>
            <ActivityIndicator color={baseColors.textPrimary} />
          </View>
        )}
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.xs,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: baseColors.textTertiary,
  },
  title: {
    ...typography.displayXL,
    color: baseColors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: baseColors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  spinner: {
    marginVertical: spacing.lg,
  },
  error: {
    ...typography.body,
    color: '#F2544C',
    marginBottom: spacing.md,
  },
  row: {
    gap: spacing.md,
  },
  listContent: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  cardWrapper: {
    flex: 1,
  },
  card: {
    flex: 1,
    backgroundColor: baseColors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: baseColors.border,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    overflow: 'hidden',
  },
  cardDisabled: {
    opacity: 0.4,
  },
  cardName: {
    ...typography.title,
    color: baseColors.textPrimary,
    textAlign: 'center',
    minHeight: 44,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
  },
  cardLeague: {
    ...typography.caption,
    color: baseColors.textTertiary,
    flex: 1,
  },
  claimingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(11,11,13,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// Kept separate from theme/colors.ts: this is a one-off UI-only error red,
// not a semantic token used elsewhere yet.
const positionErrorColor = '#F2544C';
