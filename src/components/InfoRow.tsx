import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body } from '@/components/Typography';
import { colors } from '@/theme';

type InfoRowProps = {
  icon: ReactNode;
  title?: string;
  text: string;
};

// Icon on the left, optional bold title and text on the right.
export function InfoRow({ icon, title, text }: InfoRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.icon}>{icon}</View>
      <View style={styles.texts}>
        {title ? (
          <Body size={16} weight="semibold">
            {title}
          </Body>
        ) : null}
        <Body size={title ? 14 : 15} color={title ? colors.textSecondary : colors.text}>
          {text}
        </Body>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  icon: { marginTop: 1 },
  texts: { flex: 1, gap: 4 },
});
