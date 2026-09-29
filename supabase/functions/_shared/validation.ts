// Pure input checks shared by the moderation functions (unit-tested).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const REJECTION_REASONS = ['harassment', 'inappropriate', 'personal_info', 'spam', 'other'] as const;
export type RejectionReason = (typeof REJECTION_REASONS)[number];

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

export type Decision = {
  letter_id: string;
  decision: 'approved' | 'rejected';
  reason: RejectionReason | null;
  at_risk: boolean;
  note: string | null;
  decided_by: string;
};

// Returns the cleaned decision, or a short error code for a 400 response.
export function parseDecision(input: unknown): { ok: true; value: Decision } | { ok: false; error: string } {
  if (typeof input !== 'object' || input === null) return { ok: false, error: 'invalid_body' };
  const body = input as Record<string, unknown>;

  if (!isUuid(body.letter_id)) return { ok: false, error: 'invalid_letter_id' };
  if (body.decision !== 'approved' && body.decision !== 'rejected') {
    return { ok: false, error: 'invalid_decision' };
  }

  let reason: RejectionReason | null = null;
  if (body.reason !== undefined && body.reason !== null && body.reason !== '') {
    if (!REJECTION_REASONS.includes(body.reason as RejectionReason)) return { ok: false, error: 'invalid_reason' };
    reason = body.reason as RejectionReason;
  }
  if (body.decision === 'rejected' && reason === null) return { ok: false, error: 'reason_required' };
  if (body.decision === 'approved') reason = null;

  if (body.at_risk !== undefined && typeof body.at_risk !== 'boolean') return { ok: false, error: 'invalid_at_risk' };

  if (typeof body.decided_by !== 'string' || body.decided_by.trim() === '' || body.decided_by.length > 100) {
    return { ok: false, error: 'invalid_decided_by' };
  }
  if (body.note !== undefined && body.note !== null && (typeof body.note !== 'string' || body.note.length > 1000)) {
    return { ok: false, error: 'invalid_note' };
  }

  return {
    ok: true,
    value: {
      letter_id: body.letter_id.toLowerCase(),
      decision: body.decision,
      reason,
      at_risk: body.at_risk === true,
      note: typeof body.note === 'string' && body.note.trim() !== '' ? body.note.trim() : null,
      decided_by: body.decided_by.trim(),
    },
  };
}
