import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

type Row = Database['public']['Functions']['get_my_outgoing_letters']['Returns'][number];

export type OutgoingState = 'on_the_way' | 'waiting_for_stranger' | 'not_delivered';
export type OutgoingLetter = Omit<Row, 'state'> & { state: OutgoingState };

type OutgoingLetters =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; letters: OutgoingLetter[] };

// The signed-in user's letters that have not arrived yet (plus recent ones that
// could not be delivered). Refreshed whenever the screen comes into focus.
export function useOutgoingLetters(): OutgoingLetters & { retry: () => void } {
  const [state, setState] = useState<OutgoingLetters>({ status: 'loading' });
  const loaded = useRef(false);

  const load = useCallback(() => {
    let cancelled = false;
    // Keep showing the previous list while refreshing in the background.
    if (!loaded.current) setState({ status: 'loading' });
    supabase.rpc('get_my_outgoing_letters').then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        if (!loaded.current) setState({ status: 'error' });
        return;
      }
      loaded.current = true;
      setState({ status: 'ready', letters: (data ?? []) as OutgoingLetter[] });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(load);

  return { ...state, retry: load };
}

// Re-renders every minute so "yaklaşık … içinde" stays current.
export function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
