import { forwardRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { TabTriggerSlotProps } from 'expo-router/ui';

import { colors, fonts } from '@/theme';

type TabButtonProps = TabTriggerSlotProps & {
  label: string;
  renderIcon: (color: string) => ReactNode;
};

// One item in the bottom menu; receives isFocused and onPress from TabTrigger.
export const TabButton = forwardRef<View, TabButtonProps>(function TabButton(
  { label, renderIcon, isFocused, ...props },
  ref,
) {
  const color = isFocused ? colors.text : colors.textSecondary;
  return (
    <Pressable
      ref={ref}
      {...props}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: isFocused }}
      style={styles.item}>
      {renderIcon(color)}
      <Text style={[styles.label, { color, fontFamily: isFocused ? fonts.sansSemiBold : fonts.sansMedium }]}>
        {label}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  item: {
    minWidth: 88,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  label: { fontSize: 12 },
});
