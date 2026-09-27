import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Body, Eyebrow, Heading } from '@/components/Typography';
import { Waveform } from '@/components/Waveform';
import { MAX_LETTER_SECONDS } from '@/constants/letters';
import { findIncomingLetter, type RecipientType } from '@/data/mock';
import { useTodayQuestion } from '@/hooks/useTodayQuestion';
import { formatDuration } from '@/lib/format';
import { darkColors, fonts, MIN_TOUCH } from '@/theme';

const BAR_COUNT = 36;
const barHeight = (i: number) => 10 + Math.round(Math.abs(Math.sin(i * 1.3) + Math.sin(i * 0.7)) * 22);

const TARGETS: { key: RecipientType; label: string }[] = [
  { key: 'stranger', label: 'Bir yabancıya' },
  { key: 'friend', label: 'Bir dostuma' },
];

export default function RecordScreen() {
  const { replyTo } = useLocalSearchParams<{ replyTo?: string }>();
  const replyLetter = findIncomingLetter(replyTo);
  const today = useTodayQuestion();
  const questionText =
    replyLetter?.questionText ?? (today.status === 'ready' ? today.question.text : '…');
  const [target, setTarget] = useState<RecipientType>('stranger');
  const { seconds, recording, toggle, reset } = useFakeRecorder();

  const ready = !recording && seconds > 0;
  let status = 'Kaydetmek için dokun';
  if (recording) status = 'Kaydediliyor… durdurmak için dokun';
  else if (seconds >= MAX_LETTER_SECONDS) status = 'Süre doldu, kayıt hazır';
  else if (seconds > 0) status = 'Kayıt hazır';

  return (
    <Screen background={darkColors.background} topGap={4} gap={24}>
      <StatusBar style="light" />
      <BackButton color={darkColors.text} />

      <View style={styles.question}>
        <Eyebrow color={darkColors.accent}>
          {replyLetter ? 'Cevap veriyorsun' : 'Bugünün sorusu'}
        </Eyebrow>
        <Heading size={22} color={darkColors.textSoft} style={styles.questionText}>
          {questionText}
        </Heading>
      </View>

      {replyLetter ? (
        // A reply always goes back to the sender of the original letter.
        <Body size={14} color={darkColors.textSecondary}>
          {replyLetter.senderType === 'friend'
            ? `Cevabın ${replyLetter.friendName} adlı dostuna gidecek.`
            : 'Cevabın, mektubunu dinlediğin yabancıya gidecek.'}
        </Body>
      ) : (
        <View accessibilityRole="radiogroup" accessibilityLabel="Kime gönderilecek" style={styles.segment}>
          {TARGETS.map((t) => {
            const selected = t.key === target;
            return (
              <Pressable
                key={t.key}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setTarget(t.key)}
                style={[styles.segmentItem, selected && styles.segmentItemOn]}>
                <Text style={[styles.segmentLabel, { color: selected ? darkColors.background : darkColors.textSoft }]}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={styles.recorder}>
        <View style={styles.timer}>
          <Text style={styles.timerValue}>{formatDuration(seconds)}</Text>
          <Text style={styles.timerMax}>/ {formatDuration(MAX_LETTER_SECONDS)}</Text>
        </View>

        <Waveform
          count={BAR_COUNT}
          filled={Math.min(BAR_COUNT, seconds)}
          activeColor={darkColors.accent}
          inactiveColor={darkColors.line}
          height={64}
          barHeight={barHeight}
          flatInactive
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={recording ? 'Kaydı durdur' : 'Kayda başla'}
          onPress={toggle}
          style={styles.recButton}>
          <View style={recording ? styles.recStop : styles.recDot} />
        </Pressable>

        <Body color={darkColors.textSecondary} accessibilityLiveRegion="polite">
          {status}
        </Body>
      </View>

      {ready ? (
        <View style={styles.actions}>
          <Button label="Baştan al" variant="outlineDark" onPress={reset} style={styles.resetButton} />
          {/* Static stage: nothing is uploaded yet. */}
          <Button
            label="Mektubu gönder"
            variant="light"
            onPress={() => router.replace('/on-the-way')}
            style={styles.sendButton}
          />
        </View>
      ) : (
        <View style={styles.hint}>
          <Body size={14} color={darkColors.textSecondary} style={styles.centered}>
            Sessiz bir köşe bul. Acele etme; kimse seni beklemiyor.
          </Body>
        </View>
      )}
    </Screen>
  );
}

// Stage 1 has no microphone access; a timer simulates a recording capped at 180 seconds.
function useFakeRecorder() {
  const [seconds, setSeconds] = useState(0);
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => {
      setSeconds((s) => Math.min(MAX_LETTER_SECONDS, s + 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [recording]);

  useEffect(() => {
    if (recording && seconds >= MAX_LETTER_SECONDS) setRecording(false);
  }, [recording, seconds]);

  return {
    seconds,
    recording,
    toggle: () => setRecording(!recording && seconds < MAX_LETTER_SECONDS),
    reset: () => {
      setRecording(false);
      setSeconds(0);
    },
  };
}

const styles = StyleSheet.create({
  question: { gap: 10 },
  questionText: { lineHeight: 28 },
  segment: {
    flexDirection: 'row',
    gap: 8,
    padding: 4,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: darkColors.line,
  },
  segmentItem: {
    flex: 1,
    minHeight: MIN_TOUCH,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentItemOn: { backgroundColor: darkColors.text },
  segmentLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
  },
  recorder: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
  },
  timer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  timerValue: {
    fontFamily: fonts.serif,
    fontSize: 56,
    color: darkColors.text,
    fontVariant: ['tabular-nums'],
  },
  timerMax: {
    fontFamily: fonts.sans,
    fontSize: 16,
    color: darkColors.textSecondary,
  },
  recButton: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 4,
    borderColor: darkColors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recDot: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: darkColors.record,
  },
  recStop: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: darkColors.record,
  },
  actions: { flexDirection: 'row', gap: 12 },
  resetButton: { flex: 1 },
  sendButton: { flex: 2 },
  hint: {
    minHeight: 56,
    justifyContent: 'center',
  },
  centered: { textAlign: 'center' },
});
