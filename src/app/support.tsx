import { StyleSheet, View } from 'react-native';

import { BackButton } from '@/components/BackButton';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Body, Eyebrow, Heading } from '@/components/Typography';
import { colors } from '@/theme';

// TODO: the full list of support resources is still to be decided with the product owner.
export default function SupportScreen() {
  return (
    <Screen topGap={4} gap={24}>
      <BackButton />
      <View style={styles.intro}>
        <Eyebrow>Destek kaynakları</Eyebrow>
        <Heading size={30}>Yalnız değilsin.</Heading>
        <Body size={16} color={colors.textSecondary} lineHeight={1.5}>
          Zor bir dönemden geçiyorsan, bunu biriyle paylaşmak iyi gelebilir. Aşağıdaki kaynaklar
          sana yardımcı olabilir.
        </Body>
      </View>

      <Card>
        <Body size={16} weight="semibold">
          Acil durumda 112
        </Body>
        <Body size={14} color={colors.textSecondary}>
          Kendin ya da bir başkası için hemen yardım gerekiyorsa 112 Acil Çağrı Merkezi'ni ara.
        </Body>
      </Card>

      <Card>
        <Body size={16} weight="semibold">
          Diğer kaynaklar
        </Body>
        <Body size={14} color={colors.textSecondary}>
          Bu liste yakında güncellenecek.
        </Body>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 12 },
});
