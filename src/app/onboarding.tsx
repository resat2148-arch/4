import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Button } from '@/components/Button';
import { RulesList } from '@/components/RulesList';
import { Screen, Spacer } from '@/components/Screen';
import { SupportLink } from '@/components/SupportLink';
import { Body, Eyebrow, Heading } from '@/components/Typography';
import { useConsent } from '@/state/consent';
import { colors, MIN_TOUCH } from '@/theme';

export default function OnboardingScreen() {
  const { accept } = useConsent();
  const [agreed, setAgreed] = useState(false);

  return (
    <Screen topGap={20}>
      <View style={styles.intro}>
        <Eyebrow>Sesli Mektup</Eyebrow>
        <Heading size={38} style={styles.title}>
          Burada maske yok.
        </Heading>
        <Body size={16} color={colors.textSecondary} lineHeight={1.5}>
          Sadece sesin ve dinlemeye hazır biri. Başlamadan önce birkaç kural.
        </Body>
      </View>

      <RulesList />

      <Spacer />

      <SupportLink />

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreed }}
          onPress={() => setAgreed((value) => !value)}
          style={styles.checkRow}>
          <View style={[styles.checkbox, agreed && styles.checkboxOn]}>
            {agreed ? (
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M5 12.5l4.5 4.5L19 7"
                  stroke={colors.onAccent}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            ) : null}
          </View>
          <Body style={styles.checkLabel}>18 yaşından büyüğüm ve kuralları kabul ediyorum.</Body>
        </Pressable>

        {/* Accepting flips the route guard in the root layout, which moves the user to Bugün. */}
        <Button label="Başla" disabled={!agreed} onPress={accept} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 12 },
  title: { lineHeight: 42 },
  actions: { gap: 16 },
  checkRow: {
    minHeight: MIN_TOUCH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkLabel: { flex: 1 },
});
