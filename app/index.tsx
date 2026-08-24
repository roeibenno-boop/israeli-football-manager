import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { Club } from '@/types';

export default function HomeScreen() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(
    isSupabaseConfigured
      ? null
      : 'Supabase is not configured yet. Add EXPO_PUBLIC_SUPABASE_URL and ' +
          'EXPO_PUBLIC_SUPABASE_ANON_KEY to .env (see .env.example) and restart the dev server.'
  );

  const loadClubs = useCallback(async () => {
    if (!isSupabaseConfigured) return;

    const { data, error: fetchError } = await supabase
      .from('clubs')
      .select('*')
      .order('name', { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setError(null);
      setClubs(data ?? []);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    loadClubs().finally(() => setLoading(false));
  }, [loadClubs]);

  const onRefresh = useCallback(() => {
    if (!isSupabaseConfigured) return;
    setRefreshing(true);
    loadClubs().finally(() => setRefreshing(false));
  }, [loadClubs]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle" style={styles.title}>
          Clubs
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
          Live from Supabase — confirms the app, database, and RLS policies are wired up correctly.
        </ThemedText>

        {loading && <ActivityIndicator style={styles.spacing} />}

        {!loading && error && (
          <ThemedView type="backgroundElement" style={styles.messageBox}>
            <ThemedText type="smallBold">Couldn&apos;t load clubs</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {error}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Check that EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are set in .env,
              the dev server was restarted after adding them, and the migration has been run.
            </ThemedText>
          </ThemedView>
        )}

        {!loading && !error && clubs.length === 0 && (
          <ThemedView type="backgroundElement" style={styles.messageBox}>
            <ThemedText type="small" themeColor="textSecondary">
              Connected, but no clubs yet. Insert a row into the clubs table in Supabase to see it
              appear here.
            </ThemedText>
          </ThemedView>
        )}

        <FlatList
          data={clubs}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <ThemedView type="backgroundElement" style={styles.row}>
              <ThemedText type="default">{item.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {item.short_name} · {item.league}
              </ThemedText>
            </ThemedView>
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
  title: {
    textAlign: 'left',
  },
  subtitle: {
    marginBottom: Spacing.two,
  },
  spacing: {
    marginTop: Spacing.four,
  },
  messageBox: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
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
});
