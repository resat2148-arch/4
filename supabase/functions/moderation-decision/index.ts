// Applies a moderator's decision coming from n8n (Telegram buttons).
// Auth: x-sesli-secret. Body: { letter_id, decision, reason?, at_risk?, note?, decided_by }
import { adminClient, json, verifiedSecret } from '../_shared/supabase.ts';
import { parseDecision } from '../_shared/validation.ts';

const ERRORS: Record<string, [number, string]> = {
  already_decided: [409, 'already_decided'],
  letter_not_found: [404, 'letter_not_found'],
  reason_required: [400, 'reason_required'],
  decided_by_required: [400, 'invalid_decided_by'],
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const admin = adminClient();
  if (!(await verifiedSecret(admin, req))) return json(401, { error: 'unauthorized' });

  const parsed = parseDecision(await req.json().catch(() => null));
  if (!parsed.ok) return json(400, { error: parsed.error });
  const d = parsed.value;

  const { error } = await admin.rpc('moderate_letter', {
    p_letter_id: d.letter_id,
    p_decision: d.decision,
    p_reason: d.reason,
    p_note: d.note,
    p_decided_by: d.decided_by,
    p_at_risk: d.at_risk,
  });

  if (error) {
    const known = ERRORS[error.message];
    if (known) return json(known[0], { error: known[1] });
    if (error.code === '23514') return json(400, { error: 'invalid_reason' });
    return json(500, { error: 'decision_failed' });
  }
  return json(200, { ok: true, letter_id: d.letter_id, decision: d.decision, at_risk: d.at_risk });
});
