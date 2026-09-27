import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, darkColors, fonts } from '@/theme';

type Variant = 'primary' | 'outline' | 'link' | 'light' | 'outlineDark';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

const variantStyles: Record<Variant, { container: ViewStyle; text: string; fontSize: number }> = {
  primary: {
    container: { height: 56, backgroundColor: colors.accent },
    text: colors.onAccent,
    fontSize: 16,
  },
  outline: {
    container: { height: 48, borderWidth: 1.5, borderColor: colors.text },
    text: colors.text,
    fontSize: 15,
  },
  link: {
    container: { height: 48 },
    text: colors.accent,
    fontSize: 15,
  },
  light: {
    container: { height: 56, backgroundColor: darkColors.text },
    text: darkColors.background,
    fontSize: 16,
  },
  outlineDark: {
    container: { height: 56, borderWidth: 1.5, borderColor: darkColors.lineStrong },
    text: darkColors.text,
    fontSize: 15,
  },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  style,
}: ButtonProps) {
  const v = variantStyles[variant];
  const textColor = disabled ? colors.textSecondary : v.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        v.container,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}>
      {icon ? <View>{icon}</View> : null}
      <Text style={[styles.label, { color: textColor, fontSize: v.fontSize }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
  },
  label: {
    fontFamily: fonts.sansSemiBold,
  },
  disabled: {
    backgroundColor: colors.line,
    borderWidth: 0,
  },
  pressed: {
    opacity: 0.85,
  },
});
