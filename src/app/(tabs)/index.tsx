import { Link, router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { InfoRow } from '@/components/InfoRow';
import { HeadphonesIcon, MailIcon, MicIcon } from '@/components/icons';
import { Screen, Spacer } from '@/components/Screen';
import { DELIVERY_WINDOW_TEXT } from '@/constants/letters';
import { Body, Eyebrow, Heading } from '@/components/Typography';
import { hasUnreadLetters, incomingLetters } from '@/data/mock';
import { useTodayQuestion } from '@/hooks/useTodayQuestion';
import { colors, MIN_TOUCH } from '@/theme';

export default function TodayScreen() {
  const today = useTodayQuestion();

  return (
    <Screen hasTabBar>
      <View style={styles.header}>
        <Heading size={22} weight="semibold">
          Sesli Mektup
        </Heading>
        <Link href="/mailbox" asChild>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={hasUnreadLetters ? 'Posta kutusu, yeni mektup var' : 'Posta kutusu'}
            style={styles.mailButton}>
            <MailIcon />
            {hasUnreadLetters ? <View style={styles.unreadDot} /> : null}
          </Pressable>
        </Link>
      </View>

      <View style={styles.question}>
        <Eyebrow>Bugünün sorusu</Eyebrow>
        {today.status === 'ready' ? (
          <>
            <Heading size={34}>{today.question.text}</Heading>
            <Body color={colors.textSecondary} lineHeight={1.5}>
              Sadece sesinle anlat. En fazla 3 dakika. Cevaplar {DELIVERY_WINDOW_TEXT} içinde ulaşır.
            </Body>
          </>
        ) : null}
        {today.status === 'loading' ? (
          <Body color={colors.textSecondary}>Bugünün sorusu yükleniyor…</Body>
        ) : null}
        {today.status === 'none' ? (
          <>
            <Heading size={28}>Bugün için henüz bir soru yok.</Heading>
            <Body color={colors.textSecondary} lineHeight={1.5}>
              Birazdan tekrar bak; yeni soru her gün gece yarısı yayınlanır.
            </Body>
          </>
        ) : null}
        {today.status === 'error' ? (
          <View style={styles.errorRow}>
            <Body color={colors.textSecondary}>Soru yüklenemedi. İnternet bağlantını kontrol et.</Body>
            <Button label="Tekrar dene" variant="link" onPress={today.retry} style={styles.retry} />
          </View>
        ) : null}
      </View>

      <Spacer />

      <Card>
        <InfoRow
          icon={<HeadphonesIcon size={24} color={colors.accent} />}
          title="Önce dinle, sonra anlat"
          text="Mektubunu göndermeden önce bir yabancının mektubunu dinle. Herkes konuşursa kimse duyulmaz."
        />
        {/* Static stage: opens a sample letter. Stage 6 assigns one from the stranger pool. */}
        <Button
          label="Bir mektup dinle"
          variant="outline"
          onPress={() => router.push({ pathname: '/listen/[id]', params: { id: incomingLetters[0].id } })}
        />
      </Card>

      <Button
        label="Cevabını kaydet"
        icon={<MicIcon size={20} strokeWidth={1.8} color={colors.onAccent} />}
        disabled={today.status !== 'ready'}
        onPress={() => router.push('/record')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mailButton: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: MIN_TOUCH / 2,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  question: { gap: 14 },
  errorRow: { alignItems: 'flex-start', gap: 4 },
  retry: { paddingHorizontal: 0 },
});
