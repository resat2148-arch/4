import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/BackButton';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { PauseIcon, PlayIcon } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { Body, Eyebrow, Heading } from '@/components/Typography';
import { Waveform } from '@/components/Waveform';
import { MAX_LETTER_SECONDS } from '@/constants/letters';
import { findIncomingLetter, type RecipientType } from '@/data/mock';
import { useLetterRecorder } from '@/hooks/useLetterRecorder';
import { useTodayQuestion } from '@/hooks/useTodayQuestion';
import { formatDuration } from '@/lib/format';
import { LetterError, sendLetter, uploadLetterAudio } from '@/lib/letters';
import { colors, darkColors, fonts, MIN_TOUCH } from '@/theme';

const BAR_COUNT = 36;

const TARGETS: { key: RecipientType; label: string }[] = [
  { key: 'stranger', label: 'Bir yabancıya' },
  { key: 'friend', label: 'Bir dostuma' },
];

export default function RecordScreen() {
  const { replyTo } = useLocalSearchParams<{ replyTo?: string }>();
  // Stage 6 replaces the sample letter with the real one being answered.
  const replyLetter = findIncomingLetter(replyTo);
  const today = useTodayQuestion();
  const questionText =
    replyLetter?.questionText ?? (today.status === 'ready' ? today.question.text : '…');

  const recorder = useLetterRecorder();
  const { phase, recording } = recorder;
  const player = useAudioPlayer(recording ? { uri: recording.uri } : null);
  const playback = useAudioPlayerStatus(player);

  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  // Kept across retries so a failed send does not upload the same file twice.
  const uploadedPath = useRef<string | null>(null);
  const [friendNote, setFriendNote] = useState(false);

  // Ask before throwing away an unsent recording (back button, swipe, hardware back).
  const navigation = useNavigation();
  const [leaveAction, setLeaveAction] = useState<Parameters<typeof navigation.dispatch>[0] | null>(
    null,
  );
  // While sending (and after a successful send) leaving is allowed: the letter is on its way.
  const hasUnsaved = (phase === 'recording' || phase === 'recorded') && !sending;
  usePreventRemove(hasUnsaved, ({ data }) => {
    if (phase === 'recording') recorder.stop();
    player.pause();
    setLeaveAction(data.action);
  });

  const canSend =
    phase === 'recorded' && !replyLetter && today.status === 'ready' && !sending && recording;

  const send = async () => {
    if (!canSend || !recording || today.status !== 'ready') return;
    player.pause();
    setSending(true);
    setSendError(null);
    try {
      uploadedPath.current ??= await uploadLetterAudio(recording.uri);
      await sendLetter({
        audioPath: uploadedPath.current,
        durationSec: recording.durationSec,
        questionId: today.question.id,
      });
      // `sending` stays true, so the leave guard above is already off.
      router.replace('/on-the-way');
    } catch (error) {
      const letterError = error instanceof LetterError ? error : new LetterError('unknown');
      setSendError(letterError.userMessage);
      // A rejected file (not a network problem) must be uploaded again after re-recording.
      if (!letterError.retryable) uploadedPath.current = null;
      setSending(false);
    }
  };

  const resetAll = () => {
    player.pause();
    uploadedPath.current = null;
    setSendError(null);
    recorder.reset();
  };

  const togglePreview = () => {
    if (playback.playing) {
      player.pause();
      return;
    }
    if (playback.duration > 0 && playback.currentTime >= playback.duration - 0.1) player.seekTo(0);
    player.play();
  };

  let status = 'Kaydetmek için dokun';
  if (phase === 'recording') status = 'Kaydediliyor… durdurmak için dokun';
  else if (phase === 'recorded')
    status =
      recording?.durationSec === MAX_LETTER_SECONDS ? 'Süre doldu, kayıt hazır' : 'Kayıt hazır';

  const bars = barsFor(recorder.levels, phase);
  // Once the preview has been started, the timer and bars follow playback;
  // before that they show the whole recording.
  const previewing = phase === 'recorded' && (playback.playing || playback.currentTime > 0);
  const previewProgress =
    previewing && playback.duration > 0 ? playback.currentTime / playback.duration : 1;
  const shownSeconds = previewing ? Math.floor(playback.currentTime) : recorder.elapsedSec;
  const totalSeconds = previewing && recording ? recording.durationSec : MAX_LETTER_SECONDS;

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
        <View style={styles.targetBlock}>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel="Kime gönderilecek"
            style={styles.segment}>
            {TARGETS.map((t) => {
              // Adding friends arrives in stage 7; until then only strangers.
              const available = t.key === 'stranger';
              const selected = t.key === 'stranger';
              return (
                <Pressable
                  key={t.key}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, disabled: !available }}
                  onPress={() => setFriendNote(!available)}
                  style={[styles.segmentItem, selected && styles.segmentItemOn]}>
                  <Text
                    style={[
                      styles.segmentLabel,
                      {
                        color: selected
                          ? darkColors.background
                          : available
                            ? darkColors.textSoft
                            : darkColors.lineStrong,
                      },
                    ]}>
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {friendNote ? (
            <Body size={14} color={darkColors.textSecondary} accessibilityLiveRegion="polite">
              Henüz bir dostun yok. Dost ekleme yakında geliyor.
            </Body>
          ) : null}
        </View>
      )}

      <View style={styles.recorder}>
        <View style={styles.timer}>
          <Text style={styles.timerValue}>{formatDuration(shownSeconds)}</Text>
          <Text style={styles.timerMax}>/ {formatDuration(totalSeconds)}</Text>
        </View>

        <Waveform
          count={BAR_COUNT}
          filled={phase === 'recorded' ? Math.round(previewProgress * bars.length) : bars.length}
          activeColor={darkColors.accent}
          inactiveColor={darkColors.line}
          height={64}
          barHeight={(i) => 6 + Math.round((bars[i] ?? 0) * 40)}
          flatInactive={phase !== 'recorded'}
        />

        {phase === 'recorded' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={playback.playing ? 'Duraklat' : 'Kaydını dinle'}
            onPress={togglePreview}
            disabled={sending}
            style={styles.previewButton}>
            {playback.playing ? (
              <PauseIcon color={darkColors.background} />
            ) : (
              <View style={styles.playNudge}>
                <PlayIcon color={darkColors.background} />
              </View>
            )}
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={phase === 'recording' ? 'Kaydı durdur' : 'Kayda başla'}
            onPress={phase === 'recording' ? recorder.stop : recorder.start}
            style={styles.recButton}>
            <View style={phase === 'recording' ? styles.recStop : styles.recDot} />
          </Pressable>
        )}

        <Body color={darkColors.textSecondary} accessibilityLiveRegion="polite">
          {phase === 'recorded'
            ? playback.playing
              ? 'Dinleniyor…'
              : `${status} · dinlemek için dokun`
            : status}
        </Body>

        {recorder.permission === 'denied' ? (
          <View style={styles.notice}>
            <Body size={14} color={darkColors.textSoft} style={styles.centered}>
              Mektup kaydedebilmek için mikrofon iznine ihtiyacımız var.
            </Body>
            <Button
              label="Ayarları aç"
              variant="outlineDark"
              onPress={() => Linking.openSettings()}
            />
          </View>
        ) : null}
        {recorder.error ? (
          <Body
            size={14}
            color={darkColors.accent}
            style={styles.centered}
            accessibilityLiveRegion="polite">
            {recorder.error}
          </Body>
        ) : null}
      </View>

      {phase === 'recorded' ? (
        <View style={styles.bottom}>
          {sendError ? (
            <Body
              size={14}
              color={darkColors.accent}
              style={styles.centered}
              accessibilityLiveRegion="polite">
              {sendError}
            </Body>
          ) : null}
          {replyLetter ? (
            <Body size={14} color={darkColors.textSecondary} style={styles.centered}>
              Cevap gönderme, gelen mektuplar bağlandığında açılacak.
            </Body>
          ) : null}
          <View style={styles.actions}>
            <Button
              label="Baştan al"
              variant="outlineDark"
              onPress={resetAll}
              disabled={sending}
              style={styles.resetButton}
            />
            <Button
              label={sending ? 'Gönderiliyor…' : sendError ? 'Tekrar dene' : 'Mektubu gönder'}
              variant="light"
              onPress={send}
              disabled={!canSend}
              style={styles.sendButton}
            />
          </View>
        </View>
      ) : (
        <View style={styles.hint}>
          <Body size={14} color={darkColors.textSecondary} style={styles.centered}>
            Sessiz bir köşe bul. Acele etme; kimse seni beklemiyor.
          </Body>
        </View>
      )}

      <BottomSheet
        visible={leaveAction !== null}
        onClose={() => setLeaveAction(null)}
        accessibilityLabel="Kaydı silmek istiyor musun">
        <Heading size={24}>Kaydın silinsin mi?</Heading>
        <Body color={colors.textSecondary} lineHeight={1.5}>
          Gönderilmemiş kaydın bu ekrandan çıkınca silinir.
        </Body>
        <View style={styles.sheetActions}>
          <Button
            label="Sil ve çık"
            onPress={() => {
              const action = leaveAction;
              setLeaveAction(null);
              recorder.reset();
              // Re-dispatching the intercepted action passes the guard.
              if (action) navigation.dispatch(action);
            }}
          />
          <Button label="Kayda dön" variant="link" onPress={() => setLeaveAction(null)} />
        </View>
      </BottomSheet>
    </Screen>
  );
}

// While recording: the most recent levels scroll in from the right.
// Afterwards: the whole recording squeezed into the bar count (loudest per slice).
function barsFor(levels: number[], phase: 'idle' | 'recording' | 'recorded'): number[] {
  if (phase === 'recorded' && levels.length > 0) {
    return Array.from({ length: BAR_COUNT }, (_, i) => {
      const from = Math.floor((i * levels.length) / BAR_COUNT);
      const to = Math.max(from + 1, Math.floor(((i + 1) * levels.length) / BAR_COUNT));
      return Math.max(...levels.slice(from, to));
    });
  }
  return levels.slice(-BAR_COUNT);
}

const styles = StyleSheet.create({
  question: { gap: 10 },
  questionText: { lineHeight: 28 },
  targetBlock: { gap: 10 },
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
  previewButton: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: darkColors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playNudge: { marginLeft: 4 },
  notice: { alignSelf: 'stretch', gap: 12 },
  bottom: { gap: 12 },
  actions: { flexDirection: 'row', gap: 12 },
  resetButton: { flex: 1 },
  sendButton: { flex: 2 },
  hint: {
    minHeight: 56,
    justifyContent: 'center',
  },
  centered: { textAlign: 'center' },
  sheetActions: { gap: 4 },
});
