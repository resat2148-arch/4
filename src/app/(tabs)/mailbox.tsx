import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { ClockIcon, HeadphonesIcon, PlayIcon, ShieldIcon } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { Body, Eyebrow, Heading } from '@/components/Typography';
// Incoming letters stay sample data until stage 6.
import { incomingLetters, type IncomingLetter } from '@/data/mock';
import {
  useMinuteClock,
  useOutgoingLetters,
  type OutgoingLetter,
} from '@/hooks/useOutgoingLetters';
import { formatDuration } from '@/lib/format';
import { arrivalText } from '@/lib/letters';
import { colors, radius } from '@/theme';

const recipientLabel = { stranger: 'Bir yabancıya', friend: 'Bir dostuna' } as const;

export default function MailboxScreen() {
  const outgoing = useOutgoingLetters();
  const now = useMinuteClock();

  return (
    <Screen hasTabBar>
      <Heading size={34}>Posta kutusu</Heading>

      <View style={styles.section}>
        <Eyebrow color={colors.textSecondary}>Yolda</Eyebrow>
        {outgoing.status === 'loading' ? (
          <Body color={colors.textSecondary}>Yükleniyor…</Body>
        ) : null}
        {outgoing.status === 'error' ? (
          <View style={styles.errorRow}>
            <Body color={colors.textSecondary}>
              Mektupların yüklenemedi. İnternet bağlantını kontrol et.
            </Body>
            <Button
              label="Tekrar dene"
              variant="link"
              onPress={outgoing.retry}
              style={styles.retry}
            />
          </View>
        ) : null}
        {outgoing.status === 'ready' && outgoing.letters.length === 0 ? (
          <Body color={colors.textSecondary}>Şu an yolda bir mektubun yok.</Body>
        ) : null}
        {outgoing.status === 'ready'
          ? outgoing.letters.map((letter) => (
              <OutgoingRow key={letter.id} letter={letter} now={now} />
            ))
          : null}
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

function OutgoingRow({ letter, now }: { letter: OutgoingLetter; now: number }) {
  if (letter.state === 'not_delivered') {
    // General and non-accusatory; the moderator's reason is never shown.
    return (
      <View style={[styles.pendingRow, styles.notDeliveredRow]}>
        <View style={[styles.avatar, { backgroundColor: colors.muted }]}>
          <ShieldIcon size={20} color={colors.textSecondary} />
        </View>
        <View style={styles.rowTexts}>
          <Body weight="semibold">Bu mektup iletilemedi</Body>
          <Body size={14} color={colors.textSecondary}>
            Kurallara uymayan mektuplar iletilmez.
          </Body>
        </View>
      </View>
    );
  }

  const detail =
    letter.state === 'waiting_for_stranger'
      ? 'bir yabancının dinlemesini bekliyor'
      : arrivalText(letter.deliver_after, now);

  return (
    <View style={styles.pendingRow}>
      <View style={[styles.avatar, { backgroundColor: colors.muted }]}>
        {letter.state === 'waiting_for_stranger' ? (
          <HeadphonesIcon size={20} color={colors.textSecondary} />
        ) : (
          <ClockIcon size={20} color={colors.textSecondary} />
        )}
      </View>
      <View style={styles.rowTexts}>
        <Body weight="semibold">Senin mektubun</Body>
        <Body size={14} color={colors.textSecondary}>
          {recipientLabel[letter.recipient_type]} · {detail}
        </Body>
      </View>
    </View>
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
      <View
        style={[
          styles.avatar,
          { backgroundColor: letter.listened ? colors.muted : colors.accent },
        ]}>
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
  notDeliveredRow: { borderStyle: 'solid', borderWidth: 1, borderColor: colors.line },
  errorRow: { alignItems: 'flex-start', gap: 4 },
  retry: { paddingHorizontal: 0 },
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
