import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { ConsentProvider, useConsent } from '@/state/consent';
import { colors, fontAssets } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  // Keep the splash screen up until fonts are ready so text never swaps typeface.
  if (!fontsLoaded && !fontError) return null;

  return (
    <ConsentProvider>
      <RootStack />
    </ConsentProvider>
  );
}

function RootStack() {
  const { accepted } = useConsent();

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
      {/* Until the user confirms 18+ and the rules, only onboarding is reachable. */}
      <Stack.Protected guard={!accepted}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={accepted}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="listen/[id]" />
        <Stack.Screen name="record" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="on-the-way" options={{ gestureEnabled: false }} />
      </Stack.Protected>
      <Stack.Screen name="support" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
