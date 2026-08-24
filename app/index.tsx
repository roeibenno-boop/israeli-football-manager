import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/lib/use-profile';
import type { Club, Player } from '@/types';

export default function SquadScreen() {
  const { session, loading: sessionLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile(session);

  const [club, setClub] = useState<Club | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loadingSquad, setLoadingSquad] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const managedClubId = profile?.managed_club_id ?? null;

  useEffect(() => {
    if (!managedClubId) {
      setLoadingSquad(false);
      return;
    }

    let cancelled = false;
    setLoadingSquad(true);

    Promise.all([
      supabase.from('clubs').select('*').eq('id', managedClubId).single(),
      supabase.from('players').select('*').eq('club_id', managedClubId).order('position', { ascending: true }),
    ]).then(([clubResult, playersResult]) => {
      if (cancelled) return;
      if (clubResult.error) setError(clubResult.error.message);
      else setClub(clubResult.data);
      if (playersResult.error) setError(playersResult.error.message);
      else setPlayers(playersResult.data ?? []);
      setLoadingSquad(false);
    });

    return () => {
      cancelled = true;
    };
  }, [managedClubId]);

  // Order matters: only redirect once we actually know the answer.
  if (!sessionLoading && !session) {
    return <Redirect href="/sign-in" />;
  }
  if (!profileLoading && profile && !profile.managed_club_id) {
    return <Redirect href="/pick-club" />;
  }

  const busy = sessionLoading || profileLoading || loadingSquad;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {club && (
          <>
            <ThemedText type="subtitle">{club.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
              {players.length} player{players.length === 1 ? '' : 's'} in squad
            </ThemedText>
          </>
        )}

        {busy && <ActivityIndicator style={styles.spacing} />}
        {error && (
          <ThemedText type="small" themeColor="textSecondary">
            {error}
          </ThemedText>
        )}
        {!busy && !error && players.length === 0 && club && (
          <ThemedText type="small" themeColor="textSecondary">
            No players in this squad yet.
          </ThemedText>
        )}

        <FlatList
          data={players}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <ThemedView type="backgroundElement" style={styles.row}>
              <ThemedText type="default">{item.full_name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {item.position} · Age {item.age ?? '—'} · {item.nationality}
              </ThemedText>
            </ThemedView>
          )}
        />

        <Pressable style={styles.signOut} onPress={() => supabase.auth.signOut()}>
          <ThemedText type="small" themeColor="textSecondary">
            Sign out
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.two,
  },
  subtitle: {
    marginBottom: Spacing.two,
  },
  spacing: {
    marginTop: Spacing.four,
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: Spacing.two,
    paddingBottom: Spacing.four,
  },
  row: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  signOut: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
});
