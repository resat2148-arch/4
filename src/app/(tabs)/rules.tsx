import { StyleSheet, View } from 'react-native';

import { RulesList } from '@/components/RulesList';
import { Screen } from '@/components/Screen';
import { SupportLink } from '@/components/SupportLink';
import { Body, Heading } from '@/components/Typography';
import { colors } from '@/theme';

export default function RulesScreen() {
  return (
    <Screen hasTabBar>
      <View style={styles.intro}>
        <Heading size={34}>Kurallar</Heading>
        <Body size={16} color={colors.textSecondary} lineHeight={1.5}>
          Burası yavaş ve güvenli bir yer olsun diye.
        </Body>
      </View>

      <RulesList />

      <SupportLink />
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 12 },
});
