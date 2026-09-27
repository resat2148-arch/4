import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type ConsentState = {
  accepted: boolean;
  accept: () => void;
};

const ConsentContext = createContext<ConsentState | null>(null);

// Stage 1 keeps rule/age consent in memory only; stage 2 persists it as
// profiles.age_confirmed_at in Supabase.
export function ConsentProvider({ children }: { children: ReactNode }) {
  const [accepted, setAccepted] = useState(false);
  const value = useMemo(() => ({ accepted, accept: () => setAccepted(true) }), [accepted]);
  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent(): ConsentState {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error('useConsent must be used inside ConsentProvider');
  return ctx;
}
