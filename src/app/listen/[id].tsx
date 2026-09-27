import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { FlagIcon, MicIcon, PauseIcon, PlayIcon } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { Body, Eyebrow, Heading } from '@/components/Typography';
import { Waveform } from '@/components/Waveform';
import { findIncomingLetter } from '@/data/mock';
import { formatDuration } from '@/lib/format';
import { colors, fonts, MIN_TOUCH, radius } from '@/theme';

const BAR_COUNT = 40;
const barHeight = (i: number) => 10 + Math.round(Math.abs(Math.sin(i * 0.9) + Math.sin(i * 2.3)) * 24);

export default function ListenScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const letter = findIncomingLetter(id);
  const [reportOpen, setReportOpen] = useState(false);
  const { position, playing, toggle, pause } = useFakePlayback(letter?.durationSec ?? 0);

  if (!letter) {
    return (
      <Screen topGap={4}>
        <BackButton />
        <Body>Bu mektup bulunamadı.</Body>
      </Screen>
    );
  }

  const eyebrow =
    letter.senderType === 'friend' ? `Dostundan mektup · ${letter.friendName}` : 'Bir yabancıdan mektup';
  const played = Math.floor((position / letter.durationSec) * BAR_COUNT);

  return (
    <Screen
      topGap={4}
      overlay={<ReportSheet visible={reportOpen} onClose={() => setReportOpen(false)} />}>
      <View style={styles.topBar}>
        <BackButton />
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            pause();
            setReportOpen(true);
          }}
          style={styles.reportButton}>
          <FlagIcon color={colors.textSecondary} />
          <Text style={styles.reportLabel}>Bildir</Text>
        </Pressable>
      </View>

      <View style={styles.heading}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <Heading size={26} style={styles.question}>
          “{letter.questionText}”
        </Heading>
        <Body size={14} color={colors.textSecondary}>
          {letter.questionLabel} · {formatDuration(letter.durationSec)}
        </Body>
      </View>

      <View style={styles.player}>
        <View style={styles.waveCard}>
          <Waveform
            count={BAR_COUNT}
            filled={played}
            activeColor={colors.accent}
            inactiveColor={colors.lineStrong}
            height={72}
            barHeight={barHeight}
          />
          <View style={styles.times}>
            <Text style={styles.time}>{formatDuration(position)}</Text>
            <Text style={styles.time}>{formatDuration(letter.durationSec)}</Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Duraklat' : 'Oynat'}
          onPress={toggle}
          style={styles.playButton}>
          {playing ? (
            <PauseIcon color={colors.paper} />
          ) : (
            <View style={styles.playNudge}>
              <PlayIcon color={colors.paper} />
            </View>
          )}
        </Pressable>

        <Body size={14} color={colors.textSecondary} lineHeight={1.5} style={styles.centered}>
          Bu sesin arkasında gerçek biri var. Dinlerken acele etme.
        </Body>
      </View>

      <Button
        label="Sesle cevap ver"
        icon={<MicIcon size={20} strokeWidth={1.8} color={colors.onAccent} />}
        onPress={() => router.push({ pathname: '/record', params: { replyTo: letter.id } })}
      />
    </Screen>
  );
}

// Stage 1 has no real audio; a timer advances the position so the UI can be tried out.
function useFakePlayback(durationSec: number) {
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setPosition((pos) => Math.min(durationSec, pos + 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [playing, durationSec]);

  useEffect(() => {
    if (playing && position >= durationSec) setPlaying(false);
  }, [playing, position, durationSec]);

  return {
    position,
    playing,
    pause: () => setPlaying(false),
    toggle: () => {
      if (!playing && position >= durationSec) setPosition(0);
      setPlaying(!playing);
    },
  };
}

// Keys match the reports.reason values in the data model.
const REPORT_REASONS = [
  { key: 'harassment', label: 'Taciz veya hakaret' },
  { key: 'inappropriate', label: 'Cinsel ya da uygunsuz içerik' },
  { key: 'personal_info', label: 'Kişisel bilgi paylaşımı' },
  { key: 'at_risk', label: 'Bu kişi zor durumda olabilir' },
] as const;

type ReportReason = (typeof REPORT_REASONS)[number]['key'];

function ReportSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState<ReportReason | null>(null);

  const close = () => {
    onClose();
    setReason(null);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.scrim}>
        <Pressable accessibilityLabel="Kapat" style={StyleSheet.absoluteFill} onPress={close} />
        <View
          accessibilityViewIsModal
          accessibilityLabel="Mektubu bildir"
          style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
          {reason === null ? (
            <View style={styles.sheetBody}>
              <Heading size={24}>Bu mektupta ne var?</Heading>
              <Body size={14} color={colors.textSecondary}>
                Bildirimin gizli kalır. Bir moderatör mektubu dinleyip karar verir.
              </Body>
              <View style={styles.reasons}>
                {REPORT_REASONS.map((r) => (
                  <Pressable
                    key={r.key}
                    accessibilityRole="button"
                    onPress={() => setReason(r.key)}
                    style={({ pressed }) => [styles.reason, pressed && styles.pressed]}>
                    <Body weight="medium">{r.label}</Body>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.sheetBody}>
              <Heading size={24}>Teşekkürler.</Heading>
              <Body lineHeight={1.5}>
                {reason === 'at_risk'
                  ? 'Bu mektup öncelikli olarak incelenecek ve gönderene destek kaynakları iletilecek.'
                  : 'Bu mektup incelenecek. Bu arada bu kişiden yeni mektup almayacaksın.'}
              </Body>
            </View>
          )}
          <Button label="Kapat" variant="link" onPress={close} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reportButton: {
    minHeight: MIN_TOUCH,
    paddingHorizontal: 12,
    marginRight: -12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reportLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.textSecondary,
  },
  heading: { gap: 10 },
  question: { lineHeight: 31 },
  player: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: 28,
  },
  waveCard: {
    paddingVertical: 28,
    paddingHorizontal: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.cardLarge,
    gap: 20,
  },
  times: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  time: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  playButton: {
    alignSelf: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playNudge: { marginLeft: 4 },
  centered: { textAlign: 'center' },
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.scrim,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 28,
    paddingHorizontal: 24,
    gap: 16,
  },
  sheetBody: { gap: 12 },
  reasons: { gap: 10 },
  reason: {
    minHeight: 52,
    paddingHorizontal: 18,
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.paper,
  },
  pressed: { opacity: 0.85 },
});
