import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { RulesList } from '@/components/RulesList';
import { Screen, Spacer } from '@/components/Screen';
import { SupportLink } from '@/components/SupportLink';
import { Body, Heading } from '@/components/Typography';
import { useAuth } from '@/state/auth';
import { colors } from '@/theme';

export default function RulesScreen() {
  const { session, signOut } = useAuth();

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

      <Spacer />

      {/* Temporary home for signing out until the account screen arrives in stage 7. */}
      <View style={styles.account}>
        {session?.user.email ? (
          <Body size={14} color={colors.textSecondary}>
            {session.user.email} ile giriş yapıldı
          </Body>
        ) : null}
        <Button label="Çıkış yap" variant="link" onPress={signOut} style={styles.signOut} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 12 },
  account: {
    alignItems: 'flex-start',
    gap: 4,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  signOut: { paddingHorizontal: 0 },
});
