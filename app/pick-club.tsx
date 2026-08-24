import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/lib/use-profile';
import type { Club } from '@/types';

export default function PickClubScreen() {
  const { session, loading: sessionLoading } = useAuth();
  const { profile, loading: profileLoading, refresh } = useProfile(session);

  const [clubs, setClubs] = useState<Club[]>([]);
  const [loadingClubs, setLoadingClubs] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('clubs')
      .select('*')
      .order('name', { ascending: true })
      .then(({ data, error: fetchError }) => {
        if (fetchError) setError(fetchError.message);
        else setClubs(data ?? []);
        setLoadingClubs(false);
      });
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

    setClaimingId(null);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await refresh();
    router.replace('/');
  };

  const busy = sessionLoading || profileLoading || loadingClubs;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle">Choose Your Club</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
          Every club here is currently unmanaged — this MVP doesn't yet stop two accounts from
          picking the same one. Pick carefully; there's no "change club" screen yet.
        </ThemedText>

        {busy && <ActivityIndicator style={styles.spacing} />}
        {error && (
          <ThemedText type="small" themeColor="textSecondary">
            {error}
          </ThemedText>
        )}

        <FlatList
          data={clubs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Pressable onPress={() => claim(item)} disabled={claimingId !== null}>
              <ThemedView type="backgroundElement" style={styles.row}>
                <ThemedView type="backgroundElement" style={styles.rowText}>
                  <ThemedText type="default">{item.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {item.short_name}
                  </ThemedText>
                </ThemedView>
                {claimingId === item.id && <ActivityIndicator />}
              </ThemedView>
            </Pressable>
          )}
        />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowText: {
    gap: Spacing.half,
  },
});
