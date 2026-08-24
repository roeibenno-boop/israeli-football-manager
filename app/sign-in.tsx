import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export default function SignInScreen() {
  const { session, loading: sessionLoading } = useAuth();
  const theme = useTheme();

  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Already signed in — nothing to do here.
  if (!sessionLoading && session) {
    return <Redirect href="/" />;
  }

  const onSubmit = async () => {
    if (!isSupabaseConfigured) {
      setMessage('Supabase is not configured yet (see .env.example).');
      return;
    }
    if (!email || !password) {
      setMessage('Enter an email and password.');
      return;
    }

    setSubmitting(true);
    setMessage(null);

    const { error } =
      mode === 'sign-in'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setSubmitting(false);

    if (error) {
      setMessage(error.message);
    } else if (mode === 'sign-up') {
      setMessage('Account created. If email confirmation is enabled, check your inbox before signing in.');
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          Israeli Football Manager
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
          {mode === 'sign-in' ? 'Sign in to manage your club.' : 'Create an account to get started.'}
        </ThemedText>

        <TextInput
          style={[styles.input, { borderColor: theme.backgroundSelected, color: theme.text }]}
          placeholder="Email"
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={[styles.input, { borderColor: theme.backgroundSelected, color: theme.text }]}
          placeholder="Password"
          placeholderTextColor={theme.textSecondary}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {message && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.message}>
            {message}
          </ThemedText>
        )}

        <Pressable onPress={onSubmit} disabled={submitting}>
          <ThemedView type="text" style={styles.button}>
            {submitting ? (
              <ActivityIndicator color={theme.background} />
            ) : (
              <ThemedText type="default" themeColor="background">
                {mode === 'sign-in' ? 'Sign In' : 'Sign Up'}
              </ThemedText>
            )}
          </ThemedView>
        </Pressable>

        <Pressable
          style={styles.switchMode}
          onPress={() => {
            setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
            setMessage(null);
          }}>
          <ThemedText type="small" themeColor="textSecondary">
            {mode === 'sign-in' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
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
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  title: {
    textAlign: 'center',
    fontSize: 28,
    lineHeight: 34,
    marginBottom: Spacing.one,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: Spacing.three,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  message: {
    textAlign: 'center',
  },
  button: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  switchMode: {
    alignItems: 'center',
    marginTop: Spacing.two,
  },
});
