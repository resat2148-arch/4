import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { AuthProvider, useAuth } from '@/state/auth';
import { colors, fontAssets } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const fontsReady = fontsLoaded || Boolean(fontError);

  // Keep the splash screen up until fonts are ready so text never swaps typeface.
  if (!fontsReady) return null;

  return (
    <AuthProvider>
      <RootStack />
    </AuthProvider>
  );
}

function RootStack() {
  const { initializing, phase } = useAuth();

  useEffect(() => {
    if (!initializing) SplashScreen.hideAsync();
  }, [initializing]);

  // Also wait for the stored session check, so a signed-in user never sees the sign-in screens.
  if (initializing) return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
      {/* Rules and 18+ consent: before sign-in, or after it if consent was never recorded. */}
      <Stack.Protected guard={phase === 'signedOut' || phase === 'needsConsent'}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      {/* The code screen stays up while consent is checked right after sign-in. */}
      <Stack.Protected guard={phase === 'signedOut' || phase === 'loadingProfile'}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="verify" />
      </Stack.Protected>
      <Stack.Protected guard={phase === 'ready'}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="listen/[id]" />
        <Stack.Screen name="record" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="on-the-way" options={{ gestureEnabled: false }} />
      </Stack.Protected>
      <Stack.Screen name="support" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
