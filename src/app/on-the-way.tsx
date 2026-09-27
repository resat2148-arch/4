import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { InfoRow } from '@/components/InfoRow';
import { ShieldIcon } from '@/components/icons';
import { Screen, Spacer } from '@/components/Screen';
import { DELIVERY_WINDOW_TEXT } from '@/constants/letters';
import { Body, Heading } from '@/components/Typography';
import { colors } from '@/theme';

export default function OnTheWayScreen() {
  return (
    <Screen topGap={48} gap={32}>
      <View style={styles.illustration}>
        <EnvelopeIllustration />
      </View>

      <View style={styles.texts}>
        <Heading size={34} style={styles.centered}>
          Mektubun yola çıktı.
        </Heading>
        <Body size={16} color={colors.textSecondary} lineHeight={1.5} style={styles.centered}>
          Yaklaşık {DELIVERY_WINDOW_TEXT} içinde ulaşacak. Cevap beklemek zorunda değilsin; o da acele etmek
          zorunda değil.
        </Body>
      </View>

      <Card>
        <InfoRow
          icon={<ShieldIcon color={colors.accent} />}
          title="Neden bekliyor?"
          text="Her mektup, iletilmeden önce bir moderatör tarafından dinlenir. Kurallara uymayan mektuplar iletilmez."
        />
      </Card>

      <Spacer />

      <View style={styles.actions}>
        <Button label="Posta kutuna git" onPress={() => router.replace('/mailbox')} />
        <Button label="Bugüne dön" variant="link" onPress={() => router.replace('/')} />
      </View>
    </Screen>
  );
}

function EnvelopeIllustration() {
  return (
    <Svg
      width={168}
      height={128}
      viewBox="0 0 168 128"
      fill="none"
      stroke={colors.text}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessible={false}>
      <Rect x="20" y="24" width="128" height="84" rx="6" fill={colors.surface} />
      <Path d="M20 30l64 44 64-44" />
      <Rect x="116" y="34" width="22" height="26" rx="2" stroke={colors.accent} strokeDasharray="3 3" />
      <Path d="M4 50h10M0 64h12M6 78h8" stroke={colors.accent} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  illustration: { alignItems: 'center' },
  texts: { gap: 14 },
  centered: { textAlign: 'center' },
  actions: { gap: 12 },
});
