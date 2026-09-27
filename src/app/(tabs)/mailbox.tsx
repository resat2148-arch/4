import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ClockIcon, PlayIcon } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { Body, Eyebrow, Heading } from '@/components/Typography';
import { incomingLetters, outgoingLetters, type IncomingLetter } from '@/data/mock';
import { formatDuration } from '@/lib/format';
import { colors, radius } from '@/theme';

const recipientLabel = { stranger: 'Bir yabancıya', friend: 'Bir dostuna' } as const;

export default function MailboxScreen() {
  return (
    <Screen hasTabBar>
      <Heading size={34}>Posta kutusu</Heading>

      <View style={styles.section}>
        <Eyebrow color={colors.textSecondary}>Yolda</Eyebrow>
        {outgoingLetters.length === 0 ? (
          <Body color={colors.textSecondary}>Şu an yolda bir mektubun yok.</Body>
        ) : (
          outgoingLetters.map((letter) => (
            <View key={letter.id} style={styles.pendingRow}>
              <View style={[styles.avatar, { backgroundColor: colors.muted }]}>
                <ClockIcon size={20} color={colors.textSecondary} />
              </View>
              <View style={styles.rowTexts}>
                <Body weight="semibold">Senin mektubun</Body>
                <Body size={14} color={colors.textSecondary}>
                  {recipientLabel[letter.recipientType]} · {letter.etaLabel}
                </Body>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Eyebrow color={colors.textSecondary}>Gelenler</Eyebrow>
        {incomingLetters.length === 0 ? (
          <Body color={colors.textSecondary}>Henüz sana ulaşan bir mektup yok.</Body>
        ) : (
          incomingLetters.map((letter) => <IncomingRow key={letter.id} letter={letter} />)
        )}
      </View>
    </Screen>
  );
}

function IncomingRow({ letter }: { letter: IncomingLetter }) {
  const sender = letter.senderType === 'friend' ? letter.friendName : 'Bir yabancıdan';
  const detail = `${letter.receivedLabel ?? letter.questionLabel} · ${formatDuration(letter.durationSec)}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${sender}, ${detail}${letter.listened ? '' : ', dinlenmedi'}`}
      onPress={() => router.push({ pathname: '/listen/[id]', params: { id: letter.id } })}
      style={({ pressed }) => [styles.letterRow, pressed && styles.pressed]}>
      <View style={[styles.avatar, { backgroundColor: letter.listened ? colors.muted : colors.accent }]}>
        <View style={styles.playNudge}>
          <PlayIcon size={18} color={letter.listened ? colors.text : colors.onAccent} />
        </View>
      </View>
      <View style={styles.rowTexts}>
        <Body weight="semibold">{sender}</Body>
        <Body size={14} color={colors.textSecondary}>
          {detail}
        </Body>
      </View>
      {letter.listened ? null : <View style={styles.unreadDot} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  pendingRow: {
    padding: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.lineDashed,
    borderRadius: radius.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  letterRow: {
    padding: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  pressed: { opacity: 0.85 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The play triangle is optically off-center; nudge it right.
  playNudge: { marginLeft: 2 },
  rowTexts: { flex: 1, gap: 3 },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
});
