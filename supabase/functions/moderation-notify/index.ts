// Hands one new letter to n8n for moderation.
// Called by the database (pg_net) right after a letter is created, and again
// by the retry job until n8n accepts it. Auth: x-sesli-secret.
import { adminClient, json, SECRET_HEADER, verifiedSecret } from '../_shared/supabase.ts';
import { isUuid } from '../_shared/validation.ts';

// Moderators may get to a letter hours later; the link must still work then.
const AUDIO_LINK_SECONDS = 24 * 60 * 60;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const admin = adminClient();
  const secret = await verifiedSecret(admin, req);
  if (!secret) return json(401, { error: 'unauthorized' });

  const body = await req.json().catch(() => null);
  const letterId = body?.letter_id;
  if (!isUuid(letterId)) return json(400, { error: 'invalid_letter_id' });

  const { data: rows, error } = await admin.rpc('letter_for_moderation', { p_letter_id: letterId });
  if (error) return json(500, { error: 'lookup_failed' });
  const letter = rows?.[0];
  if (!letter) return json(404, { error: 'letter_not_found' });

  const markSent = (problem?: string) =>
    admin.rpc('mark_moderation_notified', { p_letter_id: letterId, p_error: problem ?? null });

  // Decided in the meantime (e.g. a retry after a slow first attempt).
  if (letter.status !== 'in_review') {
    await markSent();
    return json(200, { skipped: 'already_decided' });
  }

  const { data: webhookUrl } = await admin.rpc('moderation_webhook_url');
  if (!webhookUrl) {
    await markSent('moderation_webhook_url is not configured');
    return json(503, { error: 'webhook_not_configured' });
  }

  const { data: signed, error: signError } = await admin.storage
    .from('letters')
    .createSignedUrl(letter.audio_path, AUDIO_LINK_SECONDS);
  if (signError || !signed) {
    await markSent('could not sign the audio link');
    return json(500, { error: 'audio_link_failed' });
  }

  // No sender identity, no e-mail: only what a moderator needs to decide.
  const payload = {
    letter_id: letter.id,
    created_at: letter.created_at,
    duration_sec: letter.duration_sec,
    recipient_type: letter.recipient_type,
    is_reply: letter.is_reply,
    question_text: letter.question_text,
    audio_url: signed.signedUrl,
    audio_expires_at: new Date(Date.now() + AUDIO_LINK_SECONDS * 1000).toISOString(),
  };

  let status = 0;
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [SECRET_HEADER]: secret },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    status = response.status;
    await response.body?.cancel();
  } catch {
    status = 0;
  }

  if (status >= 200 && status < 300) {
    await markSent();
    return json(200, { sent: true });
  }
  await markSent(status ? `n8n answered ${status}` : 'n8n did not answer');
  return json(502, { error: 'webhook_failed' });
});
