-- Moderation integration: decisions, outbox + notifications, secret, service-only
-- entry points and storage cleanup candidates. Run with: npx supabase test db
begin;
select plan(31);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local');
update public.profiles set age_confirmed_at = now();

delete from public.questions;
insert into public.questions (id, text, publish_date)
values ('10000000-0000-0000-0000-000000000002', 'Bugün seni en çok ne yordu?', private.app_today());

insert into storage.objects (bucket_id, name, owner_id, created_at)
select 'letters', format('aaaaaaaa-0000-0000-0000-%s.m4a', lpad(n::text, 12, '0')),
       '00000000-0000-0000-0000-00000000000a', now()
from generate_series(1, 4) as n;

-- Start from a clean slate for settings and recorded requests.
delete from private.settings;
delete from net.test_requests;

-- ---------------------------------------------------------------------------
-- Decisions
-- ---------------------------------------------------------------------------

select col_default_is('public', 'moderation_decisions', 'at_risk', 'false', 'decisions are not crisis cases by default');

-- ---------------------------------------------------------------------------
-- Secret
-- ---------------------------------------------------------------------------

select matches(private.moderation_secret(), '^[0-9a-f]{64}$', 'a 256-bit shared secret was generated in the vault');
select ok(public.moderation_secret_matches(private.moderation_secret()), 'the right secret matches');
select ok(not public.moderation_secret_matches('wrong'), 'a wrong secret does not match');
select ok(not public.moderation_secret_matches(null), 'a missing secret does not match');

-- ---------------------------------------------------------------------------
-- Outbox and notifications
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select public.send_letter('aaaaaaaa-0000-0000-0000-000000000001.m4a', 30, '10000000-0000-0000-0000-000000000002');
reset role;

select results_eq(
  $$select attempts, sent_at is null from private.moderation_outbox o
    join public.letters l on l.id = o.letter_id where l.audio_path = 'aaaaaaaa-0000-0000-0000-000000000001.m4a'$$,
  $$values (0, true)$$,
  'a new letter is queued for moderation'
);
select is((select count(*)::int from net.test_requests), 0, 'nothing is sent while the project URL is not configured');

insert into private.settings (key, value) values ('project_url', 'https://example.supabase.co');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select public.send_letter('aaaaaaaa-0000-0000-0000-000000000002.m4a', 30, '10000000-0000-0000-0000-000000000002');
reset role;

select set_config('test.letter2',
  (select id::text from public.letters where audio_path = 'aaaaaaaa-0000-0000-0000-000000000002.m4a'), true);

select results_eq(
  $$select url, body ->> 'letter_id', headers ->> 'x-sesli-secret' = private.moderation_secret()
    from net.test_requests order by id desc limit 1$$,
  $$values ('https://example.supabase.co/functions/v1/moderation-notify', current_setting('test.letter2'), true)$$,
  'a new letter asks moderation-notify, authenticated with the shared secret'
);
select is(
  (select attempts from private.moderation_outbox where letter_id = current_setting('test.letter2')::uuid),
  1, 'the attempt is counted'
);

-- Retries: only unsent, still-in-review letters whose last attempt is 10+ minutes old.
update private.moderation_outbox set last_attempt_at = now() - interval '11 minutes';
select is(private.retry_moderation_notifications(), 2, 'both unsent letters are retried after 10 minutes');
select is(private.retry_moderation_notifications(), 0, 'no retry right after an attempt');

select public.mark_moderation_notified(current_setting('test.letter2')::uuid);
select results_eq(
  $$select sent_at is not null, last_error from private.moderation_outbox where letter_id = current_setting('test.letter2')::uuid$$,
  $$values (true, null::text)$$,
  'a letter n8n accepted is marked sent'
);
update private.moderation_outbox set last_attempt_at = now() - interval '11 minutes';
select is(private.retry_moderation_notifications(), 1, 'sent letters are not retried');

select public.mark_moderation_notified(current_setting('test.letter2')::uuid, 'n8n answered 500');
select results_eq(
  $$select sent_at is null, last_error from private.moderation_outbox where letter_id = current_setting('test.letter2')::uuid$$,
  $$values (true, 'n8n answered 500')$$,
  'a failed hand-off keeps the letter queued with the error'
);

select private.apply_moderation_decision(
  (select id from public.letters where audio_path = 'aaaaaaaa-0000-0000-0000-000000000001.m4a'),
  'approved', null, null, 'moderator-1');
update private.moderation_outbox set last_attempt_at = now() - interval '11 minutes';
select is(private.retry_moderation_notifications(), 1, 'decided letters are not retried');

-- ---------------------------------------------------------------------------
-- Moderation through the service entry point
-- ---------------------------------------------------------------------------

select results_eq(
  $$select question_text, duration_sec::int, recipient_type::text, is_reply, status::text
    from public.letter_for_moderation(current_setting('test.letter2')::uuid)$$,
  $$values ('Bugün seni en çok ne yordu?', 30, 'stranger', false, 'in_review')$$,
  'moderators get the question, length and kind of letter'
);
select ok(
  pg_get_function_result('public.letter_for_moderation(uuid)'::regprocedure) !~ 'sender|email',
  'moderators learn nothing about the sender'
);

set local role service_role;
select throws_ok(
  $$select public.moderate_letter(current_setting('test.letter2')::uuid, 'rejected', null, null, 'telegram:1', false)$$,
  'P0001', 'reason_required', 'a rejection needs a reason'
);
select throws_ok(
  $$select public.moderate_letter(current_setting('test.letter2')::uuid, 'rejected', 'rude', null, 'telegram:1', false)$$,
  '23514', null, 'only the fixed rejection reasons are accepted'
);
select lives_ok(
  $$select public.moderate_letter(current_setting('test.letter2')::uuid, 'approved', null, 'kriz belirtisi', 'telegram:1', true)$$,
  'the service role can approve and flag a crisis'
);
reset role;

select results_eq(
  $$select decision::text, at_risk, decided_by from public.moderation_decisions
    where letter_id = current_setting('test.letter2')::uuid$$,
  $$values ('approved', true, 'telegram:1')$$,
  'the crisis flag is recorded with the decision'
);

-- ---------------------------------------------------------------------------
-- Nobody but the service role reaches the entry points or the private tables
-- ---------------------------------------------------------------------------

select ok(
  not has_function_privilege('authenticated', 'public.moderate_letter(uuid, public.moderation_decision, text, text, text, boolean)', 'execute')
  and not has_function_privilege('anon', 'public.moderate_letter(uuid, public.moderation_decision, text, text, text, boolean)', 'execute'),
  'the app cannot moderate'
);
select ok(
  not has_function_privilege('authenticated', 'public.moderation_secret_matches(text)', 'execute')
  and not has_function_privilege('anon', 'public.moderation_secret_matches(text)', 'execute'),
  'the app cannot probe the secret'
);
select ok(
  not has_function_privilege('authenticated', 'public.letter_for_moderation(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.mark_moderation_notified(uuid, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.moderation_webhook_url()', 'execute')
  and not has_function_privilege('authenticated', 'public.storage_cleanup_candidates()', 'execute'),
  'the app cannot use the other service entry points'
);
select ok(
  has_function_privilege('service_role', 'public.moderate_letter(uuid, public.moderation_decision, text, text, text, boolean)', 'execute')
  and has_function_privilege('service_role', 'public.storage_cleanup_candidates()', 'execute'),
  'the service role can'
);

set local role authenticated;
select throws_ok('select * from private.settings', '42501', null, 'settings are not readable by the app');
select throws_ok('select * from private.moderation_outbox', '42501', null, 'the outbox is not readable by the app');
select throws_ok('select private.moderation_secret()', '42501', null, 'the secret is not readable by the app');
reset role;

-- ---------------------------------------------------------------------------
-- Scheduling and storage cleanup
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int from cron.job
   where (jobname = 'retry-moderation-notifications' and schedule = '*/10 * * * *')
      or (jobname = 'storage-cleanup' and schedule = '17 3 * * *')),
  2, 'retries run every 10 minutes and cleanup once a day'
);

select private.request_storage_cleanup();
select is(
  (select url from net.test_requests order by id desc limit 1),
  'https://example.supabase.co/functions/v1/storage-cleanup',
  'the daily job calls storage-cleanup'
);

-- Candidates: a letter rejected 31 days ago, an upload that never became a
-- letter (2 days old), a fresh upload, and the audio of a live letter.
insert into public.letters (id, sender_id, recipient_type, question_id, audio_path, duration_sec, created_at, deliver_after)
values ('20000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-00000000000a', 'stranger',
        '10000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000003.m4a', 20,
        now() - interval '31 days', now() - interval '31 days' + interval '90 minutes');
select private.apply_moderation_decision('20000000-0000-0000-0000-000000000031', 'rejected', 'spam', null, 'moderator-1');
update storage.objects set created_at = now() - interval '2 days'
where name = 'aaaaaaaa-0000-0000-0000-000000000004.m4a';
insert into storage.objects (bucket_id, name, owner_id)
values ('letters', 'aaaaaaaa-0000-0000-0000-000000000005.m4a', '00000000-0000-0000-0000-00000000000a');

select set_eq(
  'select name, why from public.storage_cleanup_candidates()',
  $$values ('aaaaaaaa-0000-0000-0000-000000000003.m4a', 'rejected'),
           ('aaaaaaaa-0000-0000-0000-000000000004.m4a', 'orphan')$$,
  'old rejected audio and old orphan uploads are cleaned; fresh uploads and live letters are kept'
);

select * from finish();
rollback;
