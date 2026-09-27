import { useCallback, useEffect, useState } from 'react';

import type { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export type Question = Database['public']['Tables']['questions']['Row'];

type TodayQuestion =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'none' }
  | { status: 'ready'; question: Question };

// The question of the day; "today" is decided by the database (Europe/Istanbul).
export function useTodayQuestion(): TodayQuestion & { retry: () => void } {
  const [state, setState] = useState<TodayQuestion>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    supabase
      .rpc('get_today_question')
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setState({ status: 'error' });
        else if (!data) setState({ status: 'none' });
        else setState({ status: 'ready', question: data });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}
