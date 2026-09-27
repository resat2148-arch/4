import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { BackIcon } from '@/components/icons';
import { colors, MIN_TOUCH } from '@/theme';

export function BackButton({ color = colors.text }: { color?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Geri"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      style={styles.button}>
      <BackIcon color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    marginLeft: -10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
