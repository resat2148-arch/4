import { TabList, TabSlot, Tabs, TabTrigger } from 'expo-router/ui';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MailIcon, ShieldIcon, SunIcon } from '@/components/icons';
import { TabButton } from '@/components/TabBar';
import { colors } from '@/theme';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs style={styles.root}>
      <TabSlot />
      <TabList
        accessibilityLabel="Ana menü"
        style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
        <TabTrigger name="index" href="/" asChild>
          <TabButton label="Bugün" renderIcon={(color) => <SunIcon color={color} />} />
        </TabTrigger>
        <TabTrigger name="mailbox" href="/mailbox" asChild>
          <TabButton label="Posta kutusu" renderIcon={(color) => <MailIcon color={color} />} />
        </TabTrigger>
        <TabTrigger name="rules" href="/rules" asChild>
          <TabButton label="Kurallar" renderIcon={(color) => <ShieldIcon color={color} />} />
        </TabTrigger>
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.paper,
  },
});
