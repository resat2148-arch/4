import { Link } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { colors, fonts } from '@/theme';

export function SupportLink() {
  return (
    <Text style={styles.text}>
      Zor bir dönemden geçiyorsan yalnız değilsin.{' '}
      <Link href="/support" style={styles.link}>
        Destek kaynaklarını gör
      </Link>
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
  },
  link: {
    color: colors.accent,
    textDecorationLine: 'underline',
  },
});
