import { Redirect, Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/lib/use-profile';
import { baseColors, ClubThemeProvider, spacing, typography, useClubTheme } from '@/theme';
import type { Club } from '@/types';

/**
 * Auth-gates the whole tab group in one place (session -> /sign-in,
 * no managed club -> /pick-club) rather than duplicating the checks in
 * every tab screen, and loads the managed club's colours into
 * ClubThemeProvider so every tab is tinted consistently.
 */
export default function TabsLayout() {
  const { session, loading: sessionLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile(session);

  const [club, setClub] = useState<Club | null>(null);
  const [clubLoading, setClubLoading] = useState(true);

  const managedClubId = profile?.managed_club_id ?? null;

  useEffect(() => {
    if (!managedClubId) {
      setClubLoading(false);
      return;
    }
    let cancelled = false;
    setClubLoading(true);
    supabase
      .from('clubs')
      .select('*')
      .eq('id', managedClubId)
      .single()
      .then(({ data }) => {
        if (!cancelled) {
          setClub(data);
          setClubLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [managedClubId]);

  if (!sessionLoading && !session) {
    return <Redirect href="/sign-in" />;
  }
  if (!profileLoading && profile && !profile.managed_club_id) {
    return <Redirect href="/pick-club" />;
  }

  if (sessionLoading || profileLoading || clubLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={baseColors.textSecondary} />
      </View>
    );
  }

  return (
    <ClubThemeProvider primaryColour={club?.primary_colour} secondaryColour={club?.secondary_colour}>
      <TabsNavigator clubName={club?.name} />
    </ClubThemeProvider>
  );
}

function TabsNavigator({ clubName }: { clubName?: string }) {
  const theme = useClubTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: baseColors.surface,
          borderTopColor: baseColors.border,
          borderTopWidth: 1,
          height: 64,
          paddingTop: spacing.sm,
        },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: baseColors.textTertiary,
        tabBarLabelStyle: { ...typography.eyebrow, letterSpacing: 0.6 },
        tabBarItemStyle: { paddingVertical: 2 },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Squad', tabBarAccessibilityLabel: `${clubName ?? ''} squad` }} />
      <Tabs.Screen name="lineup" options={{ title: 'Lineup' }} />
      <Tabs.Screen name="performance" options={{ title: 'Stats' }} />
      <Tabs.Screen name="fixtures" options={{ title: 'Fixtures' }} />
      <Tabs.Screen name="table" options={{ title: 'Table' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: baseColors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
