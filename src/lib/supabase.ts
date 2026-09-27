import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import type { Database } from '@/lib/database.types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!url || !key) {
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY must be set. Copy .env.example to .env.',
  );
}
assertPublicKey(key);

export const supabase = createClient<Database>(url, key, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Sign-in uses a typed code, never a link, so there is no session in the URL.
    detectSessionInUrl: false,
    // Browsers get the default navigator lock; React Native needs an in-process lock.
    ...(Platform.OS !== 'web' ? { lock: processLock } : {}),
  },
});

// On native, refresh the session only while the app is in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

// The service_role / secret key bypasses RLS and must never ship in the app.
function assertPublicKey(value: string) {
  let isSecret = value.startsWith('sb_secret_');
  const parts = value.split('.');
  if (!isSecret && parts.length === 3) {
    try {
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      isSecret = payload?.role === 'service_role';
    } catch {
      // Not a JWT we can read; the server will reject it if it is invalid.
    }
  }
  if (isSecret) {
    throw new Error('EXPO_PUBLIC_SUPABASE_KEY is a secret key. Use the publishable (anon) key.');
  }
}
