import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

// Server-side client with the secret key (bypasses RLS). Only ever used inside
// Edge Functions; never shipped to the app.
export function adminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const secretKeys = Deno.env.get('SUPABASE_SECRET_KEYS');
  const key = secretKeys
    ? (JSON.parse(secretKeys) as Record<string, string>).default
    : Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Supabase URL or secret key is missing');
  return createClient(url, key, { auth: { persistSession: false } });
}

export const SECRET_HEADER = 'x-sesli-secret';

// Every caller (the database via pg_net, n8n) sends the shared secret from the
// vault in this header. Returns the secret when it matches, null otherwise.
export async function verifiedSecret(admin: SupabaseClient, req: Request): Promise<string | null> {
  const candidate = req.headers.get(SECRET_HEADER);
  if (!candidate) return null;
  const { data, error } = await admin.rpc('moderation_secret_matches', { p_candidate: candidate });
  return !error && data === true ? candidate : null;
}

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
