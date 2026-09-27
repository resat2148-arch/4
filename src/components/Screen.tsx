import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';

type ScreenProps = {
  children: ReactNode;
  background?: string;
  // Extra space below the status bar / notch.
  topGap?: number;
  // Tab screens sit above the tab bar, which already handles the bottom inset.
  hasTabBar?: boolean;
  gap?: number;
  overlay?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
};

// Scrollable page shell. Content uses flexGrow so spacer views can push actions
// to the bottom on tall phones while still scrolling on small ones.
export function Screen({
  children,
  background = colors.paper,
  topGap = 12,
  hasTabBar = false,
  gap = 28,
  overlay,
  contentStyle,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { backgroundColor: background }]}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={[
          styles.content,
          {
            gap,
            paddingTop: insets.top + topGap,
            paddingBottom: hasTabBar ? 24 : insets.bottom + spacing.screenBottom,
          },
          contentStyle,
        ]}
        showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
      {overlay}
    </View>
  );
}

// Flexible empty space; pushes following siblings to the bottom.
export function Spacer() {
  return <View style={styles.spacer} />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.screenX,
  },
  spacer: { flexGrow: 1 },
});
