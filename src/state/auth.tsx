import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { supabase } from '@/lib/supabase';

// Where the user is in the entry flow; the root layout picks the reachable screens from this.
//   signedOut      – rules and sign-in screens
//   loadingProfile – just signed in, checking consent (the code screen stays up)
//   needsConsent   – signed in but has not confirmed 18+ and the rules yet
//   ready          – the app
export type AuthPhase = 'signedOut' | 'loadingProfile' | 'needsConsent' | 'ready';

type AuthState = {
  // True until the stored session (and its profile) has been checked on launch.
  initializing: boolean;
  phase: AuthPhase;
  session: Session | null;
  // The user ticked the rules box before signing in; recorded right after sign-in.
  acceptRulesBeforeSignIn: () => void;
  confirmAge: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

type ProfileStatus = 'unknown' | 'loading' | 'confirmed' | 'unconfirmed';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>('unknown');
  // The first launch check (stored session + its profile) happens behind the splash
  // screen; later profile loads, after signing in, happen behind the code screen.
  const [launchChecked, setLaunchChecked] = useState(false);
  const rulesAcceptedRef = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionChecked(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;

  // Load consent for the signed-in user; record it if they accepted the rules just before.
  useEffect(() => {
    if (!userId) {
      setProfileStatus('unknown');
      return;
    }
    let cancelled = false;
    setProfileStatus('loading');
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('age_confirmed_at')
        .eq('id', userId)
        .maybeSingle();
      let confirmed = Boolean(data?.age_confirmed_at);
      if (!confirmed && rulesAcceptedRef.current) {
        const { error } = await supabase.rpc('confirm_age');
        confirmed = !error;
      }
      rulesAcceptedRef.current = false;
      // On failure the user lands on the rules screen and can confirm again from there.
      if (!cancelled) setProfileStatus(confirmed ? 'confirmed' : 'unconfirmed');
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (launchChecked || !sessionChecked) return;
    if (!session || profileStatus === 'confirmed' || profileStatus === 'unconfirmed') {
      setLaunchChecked(true);
    }
  }, [launchChecked, sessionChecked, session, profileStatus]);

  const confirmAge = useCallback(async () => {
    const { error } = await supabase.rpc('confirm_age');
    if (error) throw error;
    setProfileStatus('confirmed');
  }, []);

  const signOut = useCallback(async () => {
    rulesAcceptedRef.current = false;
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthState>(() => {
    let phase: AuthPhase = 'signedOut';
    if (session) {
      if (profileStatus === 'confirmed') phase = 'ready';
      else if (profileStatus === 'unconfirmed') phase = 'needsConsent';
      else phase = 'loadingProfile';
    }
    return {
      initializing: !launchChecked,
      phase,
      session,
      acceptRulesBeforeSignIn: () => {
        rulesAcceptedRef.current = true;
      },
      confirmAge,
      signOut,
    };
  }, [session, launchChecked, profileStatus, confirmAge, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
