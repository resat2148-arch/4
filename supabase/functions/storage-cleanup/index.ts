// Daily: deletes audio of letters rejected 30+ days ago and uploads that never
// became a letter. Called by pg_cron through pg_net. Auth: x-sesli-secret.
// Letter rows are kept; only the files go. Logs counts only, never names.
import { adminClient, json, verifiedSecret } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const admin = adminClient();
  if (!(await verifiedSecret(admin, req))) return json(401, { error: 'unauthorized' });

  const { data, error } = await admin.rpc('storage_cleanup_candidates');
  if (error) return json(500, { error: 'lookup_failed' });

  const rows = (data ?? []) as { name: string; why: 'rejected' | 'orphan' }[];
  let removed = 0;
  let failed = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100).map((row) => row.name);
    const { data: done, error: removeError } = await admin.storage.from('letters').remove(chunk);
    if (removeError) failed += chunk.length;
    else removed += done?.length ?? 0;
  }

  const summary = {
    rejected: rows.filter((row) => row.why === 'rejected').length,
    orphan: rows.filter((row) => row.why === 'orphan').length,
    removed,
    failed,
  };
  console.log('storage-cleanup', JSON.stringify(summary));
  return json(failed ? 500 : 200, summary);
});
