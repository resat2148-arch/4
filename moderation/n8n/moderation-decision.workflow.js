import { workflow, node, trigger, sticky, placeholder, newCredential, ifElse, expr } from '@n8n/workflow-sdk';

const buttonPressed = trigger({
  type: 'n8n-nodes-base.telegramTrigger',
  version: 1.5,
  config: {
    name: 'Moderatör düğmeye bastı',
    parameters: {
      updates: ['callback_query'],
      additionalFields: {
        chatIds: placeholder('Moderatör sohbetinin numarası (ör. -1001234567890)')
      }
    },
    credentials: { telegramApi: newCredential('Sesli Mektup · Telegram botu') },
    position: [240, 300]
  },
  output: [{
    callback_query: {
      id: '4382bfdwdsb323b2d9',
      data: 'r|personal_info|5a1f6d06-aeb8-44df-86fe-b854fd4901fd',
      from: { id: 111222333, username: 'moderator1', first_name: 'Ayşe' },
      message: { message_id: 101, chat: { id: -1001234567890 }, text: '🎙 Yeni mektup' }
    }
  }]
});

const parseButton = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Kararı çözümle',
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'letter-id', name: 'letter_id', value: expr('{{ $json.callback_query.data.split("|").pop() }}'), type: 'string' },
          { id: 'decision', name: 'decision', value: expr('{{ $json.callback_query.data.startsWith("a") ? "approved" : "rejected" }}'), type: 'string' },
          { id: 'reason', name: 'reason', value: expr('{{ $json.callback_query.data.startsWith("r") ? $json.callback_query.data.split("|")[1] : "" }}'), type: 'string' },
          { id: 'at-risk', name: 'at_risk', value: expr('{{ $json.callback_query.data.split("|")[0].endsWith("k") }}'), type: 'boolean' },
          { id: 'decided-by', name: 'decided_by', value: expr('telegram:{{ $json.callback_query.from.id }}{{ $json.callback_query.from.username ? " @" + $json.callback_query.from.username : "" }}'), type: 'string' },
          { id: 'query-id', name: 'query_id', value: expr('{{ $json.callback_query.id }}'), type: 'string' },
          { id: 'chat-id', name: 'chat_id', value: expr('{{ $json.callback_query.message.chat.id }}'), type: 'string' },
          { id: 'message-id', name: 'message_id', value: expr('{{ $json.callback_query.message.message_id }}'), type: 'string' },
          { id: 'label', name: 'label', value: expr('{{ ({ a: "✅ Onaylandı", ak: "✅ Onaylandı · 🆘 kriz", r: "❌ Reddedildi", rk: "❌ Reddedildi · 🆘 kriz" })[$json.callback_query.data.split("|")[0]] }}{{ $json.callback_query.data.startsWith("r") ? " (" + ({ harassment: "taciz", inappropriate: "uygunsuz içerik", personal_info: "kişisel bilgi", spam: "spam", other: "diğer" })[$json.callback_query.data.split("|")[1]] + ")" : "" }}'), type: 'string' }
        ]
      }
    },
    position: [480, 300]
  },
  output: [{
    letter_id: '5a1f6d06-aeb8-44df-86fe-b854fd4901fd',
    decision: 'rejected',
    reason: 'personal_info',
    at_risk: false,
    decided_by: 'telegram:111222333 @moderator1',
    query_id: '4382bfdwdsb323b2d9',
    chat_id: '-1001234567890',
    message_id: '101',
    label: '❌ Reddedildi (kişisel bilgi)'
  }]
});

const sendDecision = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Kararı Supabase\'e gönder',
    parameters: {
      method: 'POST',
      url: 'https://gfwzrnutfizzmzsnstub.supabase.co/functions/v1/moderation-decision',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpTemplatedCustomAuth',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify({ letter_id: $json.letter_id, decision: $json.decision, reason: $json.reason || null, at_risk: $json.at_risk, decided_by: $json.decided_by }) }}'),
      options: {
        response: { response: { fullResponse: true, neverError: true, responseFormat: 'json' } },
        timeout: 15000
      }
    },
    credentials: { httpTemplatedCustomAuth: newCredential('Sesli Mektup · Supabase karar anahtarı') },
    position: [720, 300]
  },
  output: [{ statusCode: 200, body: { ok: true } }]
});

const answerButton = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Düğmeye yanıt ver',
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'callback',
      operation: 'answerQuery',
      queryId: expr("{{ $('Kararı çözümle').item.json.query_id }}"),
      additionalFields: {
        text: expr('{{ $json.statusCode === 200 ? "Kaydedildi" : $json.statusCode === 409 ? "Bu mektuba zaten karar verilmiş" : "Kaydedilemedi (" + $json.statusCode + "), tekrar dene" }}'),
        show_alert: false
      }
    },
    credentials: { telegramApi: newCredential('Sesli Mektup · Telegram botu') },
    position: [960, 300]
  },
  output: [{ ok: true, result: true }]
});

const wasRecorded = ifElse({
  version: 2.3,
  config: {
    name: 'Karar kaydedildi mi?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [
          { leftValue: expr("{{ [200, 409].includes($('Kararı Supabase\\'e gönder').item.json.statusCode) }}"), operator: { type: 'boolean', operation: 'true', singleValue: true }, rightValue: '' }
        ],
        combinator: 'and'
      }
    },
    position: [1200, 300]
  }
});

const markMessage = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Mesajı kararla güncelle',
    parameters: {
      resource: 'message',
      operation: 'editMessageText',
      messageType: 'message',
      chatId: expr("{{ $('Kararı çözümle').item.json.chat_id }}"),
      messageId: expr("{{ $('Kararı çözümle').item.json.message_id }}"),
      text: expr("{{ $('Kararı Supabase\\'e gönder').item.json.statusCode === 200 ? $('Kararı çözümle').item.json.label : 'ℹ️ Zaten karar verilmişti' }}\n<code>{{ $('Kararı çözümle').item.json.letter_id }}</code>\n{{ $('Kararı çözümle').item.json.decided_by.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }} · {{ $now.setZone('Europe/Istanbul').toFormat('dd.MM.yyyy HH:mm') }}"),
      replyMarkup: 'none',
      additionalFields: { parse_mode: 'HTML', disable_web_page_preview: true }
    },
    credentials: { telegramApi: newCredential('Sesli Mektup · Telegram botu') },
    position: [1440, 220]
  },
  output: [{ ok: true, result: { message_id: 101 } }]
});

const note = sticky('## Moderasyon kararı\nTelegram\'daki düğme Supabase\'teki `moderation-decision` ucuna gider (başlık `x-sesli-secret`). Karar kaydedilince mesajdaki düğmeler kalkar ve ses linki silinir; kaydedilemezse düğmeler kalır, moderatör tekrar dener.', [parseButton, sendDecision, answerButton, wasRecorded, markMessage], { color: 4 });

export default workflow('sesli-mektup-moderasyon-karari', 'Sesli Mektup · Moderasyon kararı')
  .add(buttonPressed)
  .to(parseButton)
  .to(sendDecision)
  .to(answerButton)
  .to(wasRecorded.onTrue(markMessage))
  .add(note);
