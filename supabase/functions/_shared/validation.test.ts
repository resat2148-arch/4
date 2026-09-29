import { assertEquals } from 'jsr:@std/assert@1';

import { isUuid, parseDecision } from './validation.ts';

const id = '5a1f6d06-aeb8-44df-86fe-b854fd4901fd';

Deno.test('isUuid', () => {
  assertEquals(isUuid(id), true);
  assertEquals(isUuid('x'), false);
  assertEquals(isUuid(undefined), false);
});

Deno.test('approval: reason is dropped, flags and note are cleaned', () => {
  assertEquals(
    parseDecision({ letter_id: id.toUpperCase(), decision: 'approved', reason: 'spam', at_risk: true, note: '  ', decided_by: ' telegram:1 ' }),
    { ok: true, value: { letter_id: id, decision: 'approved', reason: null, at_risk: true, note: null, decided_by: 'telegram:1' } },
  );
});

Deno.test('rejection needs one of the fixed reasons', () => {
  assertEquals(parseDecision({ letter_id: id, decision: 'rejected', decided_by: 'm' }), { ok: false, error: 'reason_required' });
  assertEquals(parseDecision({ letter_id: id, decision: 'rejected', reason: 'rude', decided_by: 'm' }), { ok: false, error: 'invalid_reason' });
  assertEquals(
    parseDecision({ letter_id: id, decision: 'rejected', reason: 'personal_info', decided_by: 'm' }),
    { ok: true, value: { letter_id: id, decision: 'rejected', reason: 'personal_info', at_risk: false, note: null, decided_by: 'm' } },
  );
});

Deno.test('rejects malformed input', () => {
  assertEquals(parseDecision(null), { ok: false, error: 'invalid_body' });
  assertEquals(parseDecision({ letter_id: 'x', decision: 'approved', decided_by: 'm' }), { ok: false, error: 'invalid_letter_id' });
  assertEquals(parseDecision({ letter_id: id, decision: 'maybe', decided_by: 'm' }), { ok: false, error: 'invalid_decision' });
  assertEquals(parseDecision({ letter_id: id, decision: 'approved', decided_by: '' }), { ok: false, error: 'invalid_decided_by' });
  assertEquals(parseDecision({ letter_id: id, decision: 'approved', decided_by: 'm', at_risk: 'yes' }), { ok: false, error: 'invalid_at_risk' });
  assertEquals(parseDecision({ letter_id: id, decision: 'approved', decided_by: 'm', note: 'x'.repeat(1001) }), { ok: false, error: 'invalid_note' });
});
