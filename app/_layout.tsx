import { DarkTheme, Stack, ThemeProvider } from 'expo-router';

import { AuthProvider } from '@/lib/auth-context';

// This product is dark-only by design (broadcast/sporting feel, not a
// light/dark-adaptive business-app look) — no useColorScheme() branching.
export default function RootLayout() {
  return (
    <AuthProvider>
      <ThemeProvider value={DarkTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="pick-club" />
          <Stack.Screen name="match/[fixtureId]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="season-summary" options={{ presentation: 'modal', gestureEnabled: false }} />
          <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
          <Stack.Screen name="club/[clubId]" options={{ presentation: 'modal' }} />
        </Stack>
      </ThemeProvider>
    </AuthProvider>
  );
}
