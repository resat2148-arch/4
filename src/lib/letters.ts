import { AudioQuality, IOSOutputFormat, type RecordingOptions } from 'expo-audio';
import { randomUUID } from 'expo-crypto';
import { Platform } from 'react-native';

import { MAX_LETTER_SECONDS } from '@/constants/letters';
import { supabase } from '@/lib/supabase';

// Speech-friendly AAC in an .m4a container: mono, 22.05 kHz, 32 kbps
// (~720 KB for 180 s; the bucket allows 1 MB).
export const LETTER_RECORDING_OPTIONS: RecordingOptions = {
  extension: '.m4a',
  sampleRate: 22050,
  numberOfChannels: 1,
  bitRate: 32000,
  isMeteringEnabled: true,
  android: { outputFormat: 'mpeg4', audioEncoder: 'aac' },
  ios: { outputFormat: IOSOutputFormat.MPEG4AAC, audioQuality: AudioQuality.MEDIUM },
  // Web is only used for development checks; browsers pick their own container.
  web: { mimeType: 'audio/mp4', bitsPerSecond: 32000 },
};

export const MIN_LETTER_SECONDS = 1;

export function clampLetterSeconds(durationMillis: number): number {
  return Math.min(MAX_LETTER_SECONDS, Math.round(durationMillis / 1000));
}

// Uploads the recording to the private bucket under a random name. The path
// deliberately carries no user id: it appears in signed URLs given to strangers.
export async function uploadLetterAudio(fileUri: string): Promise<string> {
  const path = `${randomUUID()}.m4a`;
  const response = await fetch(fileUri);
  const body = await response.arrayBuffer();
  // Browsers report e.g. "audio/mp4;codecs=opus"; the bucket allows plain MIME types only.
  const contentType =
    Platform.OS === 'web'
      ? (response.headers.get('content-type') || 'audio/mp4').split(';')[0].trim()
      : 'audio/mp4';
  const { error } = await supabase.storage
    .from('letters')
    .upload(path, body, { contentType, upsert: false });
  if (error) throw new LetterError('upload_failed');
  return path;
}

type SendLetterInput = {
  audioPath: string;
  durationSec: number;
  questionId: string;
};

// Creates the letter; the server sets its status and random delivery time.
export async function sendLetter({ audioPath, durationSec, questionId }: SendLetterInput) {
  const { data, error } = await supabase.rpc('send_letter', {
    p_audio_path: audioPath,
    p_duration_sec: durationSec,
    p_question_id: questionId,
    p_recipient_type: 'stranger',
  });
  if (error) throw new LetterError(error.message);
  return data;
}

// Error codes raised by send_letter() in the database, plus upload failures.
const MESSAGES: Record<string, string> = {
  daily_limit: 'Bugün için mektup hakkın doldu (günde 5 mektup). Yarın yine buradayız.',
  invalid_question:
    'Bu sorunun süresi doldu. Bugünün sorusuna yeni bir kayıtla cevap verebilirsin.',
  not_allowed: 'Şu an mektup gönderemiyorsun.',
  invalid_recipient: 'Bu mektup gönderilemiyor.',
  invalid_audio: 'Kayıt gönderilemedi. Baştan alıp tekrar dene.',
  invalid_duration: 'Kayıt gönderilemedi. Baştan alıp tekrar dene.',
};

export class LetterError extends Error {
  // Whether trying again with the same recording can help.
  readonly retryable: boolean;

  constructor(code: string) {
    super(code);
    this.name = 'LetterError';
    this.retryable = !(code in MESSAGES);
  }

  get userMessage(): string {
    return MESSAGES[this.message] ?? 'Mektubun gönderilemedi. Kaydın duruyor; tekrar dene.';
  }
}

// Deliberately vague: letters are meant to feel slow, not tracked to the minute.
export function arrivalText(deliverAfter: string, now: number): string {
  const minutes = Math.ceil((new Date(deliverAfter).getTime() - now) / 60_000);
  if (minutes <= 0) return 'yakında ulaşır';
  if (minutes >= 90) return 'yaklaşık 2 saat içinde ulaşır';
  if (minutes >= 45) return 'yaklaşık 1 saat içinde ulaşır';
  return `yaklaşık ${Math.max(5, Math.ceil(minutes / 5) * 5)} dakika içinde ulaşır`;
}
