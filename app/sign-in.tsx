import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/PressableScale';
import { useAuth } from '@/lib/auth-context';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { baseColors, radius, spacing, typography } from '@/theme';

export default function SignInScreen() {
  const { session, loading: sessionLoading } = useAuth();

  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Text style={styles.eyebrow}>Ligat ha'Al</Text>
        <Text style={styles.title}>Israeli Football{'\n'}Manager</Text>
        <Text style={styles.subtitle}>
          {mode === 'sign-in' ? 'Sign in to manage your club.' : 'Create an account to get started.'}
        </Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={baseColors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={baseColors.textTertiary}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {message && <Text style={styles.message}>{message}</Text>}

          <PressableScale style={styles.button} onPress={onSubmit} disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color={baseColors.textInverse} />
            ) : (
              <Text style={styles.buttonText}>{mode === 'sign-in' ? 'Sign In' : 'Sign Up'}</Text>
            )}
          </PressableScale>

          <PressableScale
            style={styles.switchMode}
            onPress={() => {
              setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
              setMessage(null);
            }}>
            <Text style={styles.switchModeText}>
              {mode === 'sign-in' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </Text>
          </PressableScale>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: baseColors.background,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    maxWidth: 420,
    alignSelf: 'center',
    width: '100%',
  },
  eyebrow: {
    ...typography.eyebrow,
    color: baseColors.textTertiary,
    textAlign: 'center',
  },
  title: {
    ...typography.displayXL,
    fontSize: 34,
    lineHeight: 36,
    color: baseColors.textPrimary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: baseColors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  form: {
    gap: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderColor: baseColors.border,
    backgroundColor: baseColors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: baseColors.textPrimary,
  },
  message: {
    ...typography.caption,
    color: baseColors.textSecondary,
    textAlign: 'center',
  },
  button: {
    backgroundColor: baseColors.textPrimary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonText: {
    ...typography.bodyBold,
    color: baseColors.textInverse,
  },
  switchMode: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  switchModeText: {
    ...typography.caption,
    color: baseColors.textSecondary,
  },
});
