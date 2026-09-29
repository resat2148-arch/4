// Static placeholder data for the stage 1 screens. Replaced by Supabase queries in later stages.

export type RecipientType = 'stranger' | 'friend';

export type IncomingLetter = {
  id: string;
  // Friends are shown by display name; strangers are never identified.
  senderType: RecipientType;
  friendName?: string;
  questionText: string;
  questionLabel: string;
  durationSec: number;
  listened: boolean;
  receivedLabel?: string;
};

export const todayQuestion = {
  id: 'q-today',
  text: 'Bugün seni en çok ne yordu ve bunu kimseye söyleyemedin?',
};

export const incomingLetters: IncomingLetter[] = [
  {
    id: 'l-1',
    senderType: 'stranger',
    questionText: todayQuestion.text,
    questionLabel: 'Bugünün sorusuna cevap',
    durationSec: 134,
    listened: false,
  },
  {
    id: 'l-2',
    senderType: 'friend',
    friendName: 'Deniz',
    questionText: 'Son zamanlarda kimseye söylemediğin bir sevincin var mı?',
    questionLabel: 'Dünün sorusuna cevap',
    durationSec: 97,
    listened: false,
  },
  {
    id: 'l-3',
    senderType: 'stranger',
    questionText: 'Küçükken seni en çok ne korkuturdu?',
    questionLabel: 'Eski bir soruya cevap',
    durationSec: 171,
    listened: true,
    receivedLabel: '3 gün önce',
  },
];

export function findIncomingLetter(id: string | undefined): IncomingLetter | undefined {
  return incomingLetters.find((letter) => letter.id === id);
}

export const hasUnreadLetters = incomingLetters.some((letter) => !letter.listened);
