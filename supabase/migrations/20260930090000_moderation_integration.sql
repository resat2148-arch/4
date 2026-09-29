-- Sesli Mektup stage 5: moderation integration (n8n + Telegram live outside the app).
--
--   new letter --trigger--> outbox --pg_net--> Edge Function moderation-notify
--       --signed audio link, x-sesli-secret--> n8n webhook --> Telegram
--   Telegram button --> n8n --x-sesli-secret--> Edge Function moderation-decision
--       --> private.apply_moderation_decision()
--
-- One shared secret (Vault: moderation_secret) authenticates every hop. The
-- n8n webhook URL and the project URL live in private.settings.

create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- Decisions: crisis flag and fixed rejection reasons
-- ---------------------------------------------------------------------------

-- A letter showing signs of crisis; its sender is shown support resources (stage 7).
alter table public.moderation_decisions add column at_risk boolean not null default false;

-- Older test decisions may carry other reasons, hence NOT VALID (new rows only).
alter table public.moderation_decisions
  add constraint moderation_decisions_reason_check
  check (reason is null or reason in ('harassment', 'inappropriate', 'personal_info', 'spam', 'other'))
  not valid;

drop function private.apply_moderation_decision(uuid, public.moderation_decision, text, text, text);

create function private.apply_moderation_decision(
  p_letter_id uuid,
  p_decision public.moderation_decision,
  p_reason text,
  p_note text,
  p_decided_by text,
  p_at_risk boolean default false
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_status public.letter_status;
begin
  if p_decided_by is null or btrim(p_decided_by) = '' then
    raise exception 'decided_by_required';
  end if;
  select status into v_status from public.letters where id = p_letter_id for update;
  if not found then
    raise exception 'letter_not_found';
  end if;
  -- Checked before the input so a repeated button press gets a clear answer.
  if v_status <> 'in_review' then
    raise exception 'already_decided';
  end if;
  if p_decision = 'rejected' and p_reason is null then
    raise exception 'reason_required';
  end if;

  update public.letters
  set status = p_decision::text::public.letter_status,
      -- Internal only: senders never see it (no column grant).
      reject_reason = case when p_decision = 'rejected' then p_reason end
  where id = p_letter_id;

  insert into public.moderation_decisions (letter_id, decision, reason, note, decided_by, at_risk)
  values (p_letter_id, p_decision, p_reason, p_note, p_decided_by, coalesce(p_at_risk, false));
end;
$$;

revoke all on function private.apply_moderation_decision(uuid, public.moderation_decision, text, text, text, boolean)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Configuration
-- ---------------------------------------------------------------------------

-- Non-secret settings: project_url (to reach Edge Functions) and
-- moderation_webhook_url (n8n). Set per environment, not in migrations.
create table private.settings (
  key text primary key,
  value text not null
);
revoke all on private.settings from public, anon, authenticated;

-- The shared secret is generated inside the database and never leaves it
-- except to the Edge Functions (service role) and to whoever reads it in the
-- SQL editor to configure n8n.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'moderation_secret') then
    perform vault.create_secret(
      replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
      'moderation_secret',
      'Shared secret between Supabase and n8n for letter moderation (header x-sesli-secret).'
    );
  end if;
end;
$$;

create function private.moderation_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'moderation_secret';
$$;
revoke all on function private.moderation_secret() from public, anon, authenticated;

create function private.setting(p_key text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select value from private.settings where key = p_key;
$$;
revoke all on function private.setting(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Outbox: every new letter must reach a moderator, even if n8n is down.
-- moderation-notify marks a row sent once n8n accepts it; the rest is retried.
-- ---------------------------------------------------------------------------

create table private.moderation_outbox (
  letter_id uuid primary key references public.letters (id) on delete cascade,
  created_at timestamptz not null default now(),
  attempts integer not null default 0,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  last_error text
);
revoke all on private.moderation_outbox from public, anon, authenticated;

-- Asks moderation-notify to send one letter to n8n. Asynchronous (pg_net sends
-- after commit); does nothing until the project URL is configured.
create function private.request_moderation_notification(p_letter_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_url text := private.setting('project_url');
  v_secret text := private.moderation_secret();
begin
  if v_url is null or v_secret is null then
    return;
  end if;

  perform net.http_post(
    url := v_url || '/functions/v1/moderation-notify',
    body := jsonb_build_object('letter_id', p_letter_id),
    headers := jsonb_build_object('content-type', 'application/json', 'x-sesli-secret', v_secret),
    timeout_milliseconds := 10000
  );

  update private.moderation_outbox
  set attempts = attempts + 1, last_attempt_at = now()
  where letter_id = p_letter_id;
end;
$$;
revoke all on function private.request_moderation_notification(uuid) from public, anon, authenticated;

create function private.enqueue_moderation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.moderation_outbox (letter_id) values (new.id);
  perform private.request_moderation_notification(new.id);
  return new;
end;
$$;

create trigger letters_enqueue_moderation
  after insert on public.letters
  for each row execute function private.enqueue_moderation();

-- Every 10 minutes: resend what n8n has not accepted yet (letters still in
-- review, waited at least 10 minutes since the last attempt, at most 50 tries).
create function private.retry_moderation_notifications()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_letter_id uuid;
  v_count integer := 0;
begin
  for v_letter_id in
    select o.letter_id
    from private.moderation_outbox o
    join public.letters l on l.id = o.letter_id
    where o.sent_at is null
      and l.status = 'in_review'
      and o.attempts < 50
      and (o.last_attempt_at is null or o.last_attempt_at < now() - interval '10 minutes')
    order by o.created_at
    limit 100
  loop
    perform private.request_moderation_notification(v_letter_id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke all on function private.retry_moderation_notifications() from public, anon, authenticated;

-- Letters sent before this migration were never announced; queue them now.
insert into private.moderation_outbox (letter_id)
select id from public.letters where status = 'in_review'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Daily storage cleanup (Edge Function storage-cleanup does the deleting,
-- since files must be removed through the Storage API):
--   * audio of letters rejected more than 30 days ago
--   * uploads older than 24 hours that never became a letter
-- ---------------------------------------------------------------------------

create function private.request_storage_cleanup()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_url text := private.setting('project_url');
  v_secret text := private.moderation_secret();
begin
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := v_url || '/functions/v1/storage-cleanup',
    body := '{}'::jsonb,
    headers := jsonb_build_object('content-type', 'application/json', 'x-sesli-secret', v_secret),
    timeout_milliseconds := 60000
  );
end;
$$;
revoke all on function private.request_storage_cleanup() from public, anon, authenticated;

select cron.schedule(
  'retry-moderation-notifications',
  '*/10 * * * *',
  $$select private.retry_moderation_notifications();$$
);

-- 03:17 UTC, a quiet hour in Türkiye.
select cron.schedule(
  'storage-cleanup',
  '17 3 * * *',
  $$select private.request_storage_cleanup();$$
);

-- ---------------------------------------------------------------------------
-- Entry points for the Edge Functions. They run with the service role;
-- nobody else can call these.
-- ---------------------------------------------------------------------------

create function public.moderation_secret_matches(p_candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_candidate is not null
     and p_candidate = private.moderation_secret();
$$;

create function public.moderation_webhook_url()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select private.setting('moderation_webhook_url');
$$;

-- What a moderator needs, and nothing about who sent it.
create function public.letter_for_moderation(p_letter_id uuid)
returns table (
  id uuid,
  status public.letter_status,
  created_at timestamptz,
  duration_sec smallint,
  recipient_type public.recipient_type,
  is_reply boolean,
  question_text text,
  audio_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, l.status, l.created_at, l.duration_sec, l.recipient_type,
         l.reply_to_letter_id is not null, q.text, l.audio_path
  from public.letters l
  join public.questions q on q.id = l.question_id
  where l.id = p_letter_id;
$$;

create function public.mark_moderation_notified(p_letter_id uuid, p_error text default null)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update private.moderation_outbox
  set sent_at = case when p_error is null then now() end,
      last_error = left(p_error, 500)
  where letter_id = p_letter_id;
$$;

create function public.moderate_letter(
  p_letter_id uuid,
  p_decision public.moderation_decision,
  p_reason text,
  p_note text,
  p_decided_by text,
  p_at_risk boolean
)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  select private.apply_moderation_decision(p_letter_id, p_decision, p_reason, p_note, p_decided_by, p_at_risk);
$$;

create function public.storage_cleanup_candidates()
returns table (name text, why text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.name, 'rejected'
  from storage.objects o
  join public.letters l on l.audio_path = o.name
  where o.bucket_id = 'letters'
    and l.status = 'rejected'
    and l.created_at < now() - interval '30 days'
  union all
  select o.name, 'orphan'
  from storage.objects o
  where o.bucket_id = 'letters'
    and o.created_at < now() - interval '24 hours'
    and not exists (select 1 from public.letters l where l.audio_path = o.name)
  limit 1000;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.moderation_secret_matches(text)',
    'public.moderation_webhook_url()',
    'public.letter_for_moderation(uuid)',
    'public.mark_moderation_notified(uuid, text)',
    'public.moderate_letter(uuid, public.moderation_decision, text, text, text, boolean)',
    'public.storage_cleanup_candidates()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;
