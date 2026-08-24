import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types';

/**
 * Loads the signed-in user's profile row, creating one on first sign-in
 * (profiles.id references auth.users(id) — every user needs exactly one).
 */
export function useProfile(session: Session | null) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    if (data) {
      setProfile(data);
      setError(null);
      setLoading(false);
      return;
    }

    // First sign-in for this user: create their profile row.
    const defaultDisplayName = session.user.email?.split('@')[0] ?? 'Manager';
    const { data: created, error: insertError } = await supabase
      .from('profiles')
      .insert({ id: session.user.id, display_name: defaultDisplayName })
      .select('*')
      .single();

    if (insertError) {
      setError(insertError.message);
    } else {
      setProfile(created);
      setError(null);
    }
    setLoading(false);
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  return { profile, loading, error, refresh: load };
}
