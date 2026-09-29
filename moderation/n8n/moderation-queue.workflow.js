import { workflow, node, trigger, sticky, placeholder, newCredential, expr } from '@n8n/workflow-sdk';

const letterWebhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Yeni mektup (Supabase)',
    parameters: {
      httpMethod: 'POST',
      path: 'sesli-mektup-moderasyon',
      authentication: 'headerAuth',
      responseMode: 'lastNode',
      responseData: 'noData'
    },
    credentials: { httpHeaderAuth: newCredential('Sesli Mektup · x-sesli-secret') },
    position: [240, 300]
  },
  output: [{
    body: {
      letter_id: '5a1f6d06-aeb8-44df-86fe-b854fd4901fd',
      created_at: '2026-09-29T18:40:00Z',
      duration_sec: 42,
      recipient_type: 'stranger',
      is_reply: false,
      question_text: 'Bugün seni en çok ne yordu ve bunu kimseye söyleyemedin?',
      audio_url: 'https://example.supabase.co/storage/v1/object/sign/letters/x.m4a?token=abc',
      audio_expires_at: '2026-09-30T18:40:00Z'
    }
  }]
});

const sendToModerators = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Moderatörlere gönder',
    parameters: {
      resource: 'message',
      operation: 'sendMessage',
      chatId: placeholder('Moderatör sohbetinin numarası (ör. -1001234567890)'),
      text: expr('🎙 <b>Yeni mektup</b> · {{ $json.body.duration_sec }} sn · {{ $json.body.recipient_type === "friend" ? "dost mektubu" : "yabancıya" }}{{ $json.body.is_reply ? " · cevap" : "" }}\n\n<b>Soru:</b> {{ String($json.body.question_text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") }}\n\n<a href="{{ $json.body.audio_url }}">▶️ Sesi dinle</a> (link 24 saat geçerli)\n<code>{{ $json.body.letter_id }}</code>'),
      replyMarkup: 'inlineKeyboard',
      inlineKeyboard: {
        rows: [
          { row: { buttons: [
            { text: '✅ Onayla', additionalFields: { callback_data: expr('a|{{ $json.body.letter_id }}') } },
            { text: '🆘 Onayla · kriz', additionalFields: { callback_data: expr('ak|{{ $json.body.letter_id }}') } }
          ] } },
          { row: { buttons: [
            { text: '❌ Taciz', additionalFields: { callback_data: expr('r|harassment|{{ $json.body.letter_id }}') } },
            { text: '❌ Uygunsuz', additionalFields: { callback_data: expr('r|inappropriate|{{ $json.body.letter_id }}') } }
          ] } },
          { row: { buttons: [
            { text: '❌ Kişisel bilgi', additionalFields: { callback_data: expr('r|personal_info|{{ $json.body.letter_id }}') } },
            { text: '❌ Spam', additionalFields: { callback_data: expr('r|spam|{{ $json.body.letter_id }}') } }
          ] } },
          { row: { buttons: [
            { text: '❌ Diğer', additionalFields: { callback_data: expr('r|other|{{ $json.body.letter_id }}') } },
            { text: '🆘 Reddet · kriz', additionalFields: { callback_data: expr('rk|other|{{ $json.body.letter_id }}') } }
          ] } }
        ]
      },
      additionalFields: {
        appendAttribution: false,
        disable_web_page_preview: true,
        parse_mode: 'HTML'
      }
    },
    credentials: { telegramApi: newCredential('Sesli Mektup · Telegram botu') },
    position: [560, 300]
  },
  output: [{ ok: true, result: { message_id: 101, chat: { id: -1001234567890, type: 'supergroup' } } }]
});

const note = sticky('## Moderasyon kuyruğu\nSupabase her yeni mektubu buraya gönderir (başlık `x-sesli-secret` ile doğrulanır). Mesaj Telegram\'a gidemezse Supabase hata alır ve 10 dakika sonra yeniden dener.\n\nSes dosyası Telegram\'a yüklenmez; yalnızca 24 saat geçerli bir link gider (önizleme kapalı).', [letterWebhook, sendToModerators], { color: 4 });

export default workflow('sesli-mektup-moderasyon-kuyrugu', 'Sesli Mektup · Moderasyon kuyruğu')
  .add(letterWebhook)
  .to(sendToModerators)
  .add(note);
