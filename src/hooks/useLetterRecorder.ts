import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingStatus,
} from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { MAX_LETTER_SECONDS } from '@/constants/letters';
import { clampLetterSeconds, LETTER_RECORDING_OPTIONS, MIN_LETTER_SECONDS } from '@/lib/letters';

export type RecorderPhase = 'idle' | 'recording' | 'recorded';
export type MicPermission = 'unknown' | 'granted' | 'denied';

export type Recording = {
  uri: string;
  durationSec: number;
};

// One level sample per this many ms of recording, used to draw the waveform.
const LEVEL_SAMPLE_MS = 250;

// Records one letter: microphone permission, a hard stop at 180 s, audio levels
// for the waveform, and stopping (keeping what was said) if the app is left.
export function useLetterRecorder() {
  const statusListener = useRef<(status: RecordingStatus) => void>(() => {});
  const recorder = useAudioRecorder(LETTER_RECORDING_OPTIONS, (status) =>
    statusListener.current(status),
  );
  const state = useAudioRecorderState(recorder, 100);

  const [phase, setPhaseState] = useState<RecorderPhase>('idle');
  const phaseRef = useRef<RecorderPhase>('idle');
  const setPhase = (next: RecorderPhase) => {
    phaseRef.current = next;
    setPhaseState(next);
  };

  const [permission, setPermission] = useState<MicPermission>('unknown');
  const [recording, setRecording] = useState<Recording | null>(null);
  const [levels, setLevels] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const elapsedMs = useRef(0);
  const lastSampleMs = useRef(-LEVEL_SAMPLE_MS);

  // Called once whenever a recording ends, whether stopped by the user,
  // by the 180 s limit, or by leaving the app.
  const finish = useCallback(() => {
    if (phaseRef.current !== 'recording') return;
    const uri = recorder.uri;
    const durationSec = clampLetterSeconds(elapsedMs.current);
    // Playback after recording must not go to the earpiece on iOS.
    setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    if (!uri || durationSec < MIN_LETTER_SECONDS) {
      setPhase('idle');
      setLevels([]);
      setError('Kayıt çok kısa oldu. Tekrar dene.');
      return;
    }
    setRecording({ uri, durationSec });
    setPhase('recorded');
  }, [recorder]);

  statusListener.current = (status) => {
    if (status.hasError) setError('Kayıt sırasında bir sorun oluştu. Tekrar dene.');
    if (status.isFinished || status.hasError) finish();
  };

  // Track elapsed time and audio levels while recording.
  useEffect(() => {
    if (phase !== 'recording') return;
    elapsedMs.current = Math.max(elapsedMs.current, state.durationMillis);
    if (state.durationMillis - lastSampleMs.current >= LEVEL_SAMPLE_MS) {
      lastSampleMs.current = state.durationMillis;
      setLevels((prev) => [...prev, meteringToLevel(state.metering)]);
    }
  }, [phase, state.durationMillis, state.metering]);

  const stop = useCallback(async () => {
    if (phaseRef.current !== 'recording') return;
    elapsedMs.current = Math.max(elapsedMs.current, recorder.getStatus().durationMillis);
    try {
      await recorder.stop();
    } finally {
      finish();
    }
  }, [recorder, finish]);

  // Safety net in case the native duration limit does not fire.
  useEffect(() => {
    if (phase === 'recording' && state.durationMillis >= MAX_LETTER_SECONDS * 1000) stop();
  }, [phase, state.durationMillis, stop]);

  // Leaving the app (or a phone call) stops the recording and keeps what was said.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') stop();
    });
    return () => subscription.remove();
  }, [stop]);

  const start = useCallback(async () => {
    if (phaseRef.current !== 'idle') return;
    setError(null);
    try {
      let granted = (await getRecordingPermissionsAsync()).granted;
      if (!granted) granted = (await requestRecordingPermissionsAsync()).granted;
      setPermission(granted ? 'granted' : 'denied');
      if (!granted) return;

      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      elapsedMs.current = 0;
      lastSampleMs.current = -LEVEL_SAMPLE_MS;
      setLevels([]);
      setPhase('recording');
      recorder.record({ forDuration: MAX_LETTER_SECONDS });
    } catch {
      setPhase('idle');
      setError('Kayıt başlatılamadı. Tekrar dene.');
    }
  }, [recorder]);

  const reset = useCallback(async () => {
    if (phaseRef.current === 'recording') {
      phaseRef.current = 'idle';
      await recorder.stop().catch(() => {});
    }
    setRecording(null);
    setLevels([]);
    setError(null);
    setPhase('idle');
  }, [recorder]);

  const elapsedSec =
    phase === 'recording'
      ? Math.min(MAX_LETTER_SECONDS, Math.floor(state.durationMillis / 1000))
      : (recording?.durationSec ?? 0);

  return { phase, permission, recording, levels, elapsedSec, error, start, stop, reset };
}

// Metering is in dBFS (about -160 silent … 0 loudest); map speech range to 0…1.
function meteringToLevel(metering: number | undefined): number {
  if (metering === undefined || !Number.isFinite(metering)) return 0.15;
  const floor = -50;
  return Math.max(0, Math.min(1, (metering - floor) / -floor));
}
