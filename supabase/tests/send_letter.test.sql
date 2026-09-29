-- Storage policies for letter audio and send_letter(). Run with: npx supabase test db
begin;
select plan(40);

-- ---------------------------------------------------------------------------
-- Fixtures (as the migration owner)
-- A, B: consented; C: no consent; D: consented but banned. A and B are friends.
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'c@test.local'),
  ('00000000-0000-0000-0000-00000000000d', 'd@test.local');

update public.profiles set age_confirmed_at = now()
where id in ('00000000-0000-0000-0000-00000000000a',
             '00000000-0000-0000-0000-00000000000b',
             '00000000-0000-0000-0000-00000000000d');
update public.profiles set is_banned = true where id = '00000000-0000-0000-0000-00000000000d';

delete from public.questions;
insert into public.questions (id, text, publish_date) values
  ('10000000-0000-0000-0000-000000000000', 'iki gün önce', private.app_today() - 2),
  ('10000000-0000-0000-0000-000000000001', 'dün', private.app_today() - 1),
  ('10000000-0000-0000-0000-000000000002', 'bugün', private.app_today()),
  ('10000000-0000-0000-0000-000000000003', 'yarın', private.app_today() + 1);

insert into public.friendships (user_a, user_b, status) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'accepted');

-- Uploaded files: a1..a8 belong to A, b1..b3 to B, c1 to C, d1 to D.
insert into storage.objects (bucket_id, name, owner_id)
select 'letters', format('aaaaaaaa-0000-0000-0000-%s.m4a', lpad(n::text, 12, '0')),
       '00000000-0000-0000-0000-00000000000a'
from generate_series(1, 8) as n;
insert into storage.objects (bucket_id, name, owner_id)
select 'letters', format('bbbbbbbb-0000-0000-0000-%s.m4a', lpad(n::text, 12, '0')),
       '00000000-0000-0000-0000-00000000000b'
from generate_series(1, 3) as n;
insert into storage.objects (bucket_id, name, owner_id) values
  ('letters', 'cccccccc-0000-0000-0000-000000000001.m4a', '00000000-0000-0000-0000-00000000000c'),
  ('letters', 'dddddddd-0000-0000-0000-000000000001.m4a', '00000000-0000-0000-0000-00000000000d');

-- ---------------------------------------------------------------------------
-- Bucket
-- ---------------------------------------------------------------------------

select results_eq(
  $$select public, file_size_limit from storage.buckets where id = 'letters'$$,
  $$values (false, 1048576::bigint)$$,
  'letters bucket is private and capped at 1 MB'
);

-- ---------------------------------------------------------------------------
-- Storage policies (as A)
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('letters', 'eeeeeeee-0000-0000-0000-000000000001.m4a', '00000000-0000-0000-0000-00000000000a')$$,
  'A can upload a {uuid}.m4a file as themselves'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('letters', 'eeeeeeee-0000-0000-0000-000000000002.m4a', '00000000-0000-0000-0000-00000000000b')$$,
  '42501', null, 'A cannot upload in someone else''s name'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('letters', '00000000-0000-0000-0000-00000000000a/eeeeeeee-0000-0000-0000-000000000003.m4a',
            '00000000-0000-0000-0000-00000000000a')$$,
  '42501', null, 'paths with folders (e.g. a user id) are rejected'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('letters', 'notes.txt', '00000000-0000-0000-0000-00000000000a')$$,
  '42501', null, 'only .m4a names are accepted'
);
select is(
  (select count(*)::int from storage.objects where bucket_id = 'letters'),
  9,
  'A sees only their own files'
);
-- No update policy: the statement runs but changes nothing.
update storage.objects set name = 'eeeeeeee-0000-0000-0000-000000000009.m4a'
where name = 'eeeeeeee-0000-0000-0000-000000000001.m4a';
select is(
  (select count(*)::int from storage.objects where name = 'eeeeeeee-0000-0000-0000-000000000001.m4a'),
  1,
  'files cannot be changed after upload'
);

delete from storage.objects where name = 'bbbbbbbb-0000-0000-0000-000000000003.m4a';
reset role;
select ok(
  exists (select 1 from storage.objects where name = 'bbbbbbbb-0000-0000-0000-000000000003.m4a'),
  'A cannot delete B''s file'
);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

delete from storage.objects where name = 'eeeeeeee-0000-0000-0000-000000000001.m4a';
select is(
  (select count(*)::int from storage.objects where name = 'eeeeeeee-0000-0000-0000-000000000001.m4a'),
  0,
  'A can delete their own file'
);

-- ---------------------------------------------------------------------------
-- send_letter (as A)
-- ---------------------------------------------------------------------------

select isnt(
  public.send_letter('aaaaaaaa-0000-0000-0000-000000000001.m4a', 60, '10000000-0000-0000-0000-000000000002'),
  null,
  'A can send a stranger letter for today''s question'
);
select is(
  (select count(*)::int from public.letters where status = 'in_review'),
  1,
  'the letter starts in review'
);
select throws_ok(
  $$select public.send_letter('aaaaaaaa-0000-0000-0000-000000000001.m4a', 60, '10000000-0000-0000-0000-000000000002')$$,
  'P0001', 'invalid_audio', 'one file cannot be sent twice'
);
select throws_ok(
  $$select public.send_letter('bbbbbbbb-0000-0000-0000-000000000001.m4a', 60, '10000000-0000-0000-0000-000000000002')$$,
  'P0001', 'invalid_audio', 'A cannot send B''s file'
);
select throws_ok(
  $$select public.send_letter('ffffffff-0000-0000-0000-000000000001.m4a', 60, '10000000-0000-0000-0000-000000000002')$$,
  'P0001', 'invalid_audio', 'a file that was never uploaded is rejected'
);
select throws_ok(
  $$select public.send_letter('aaaaaaaa-0000-0000-0000-000000000002.m4a', 0, '10000000-0000-0000-0000-000000000002')$$,
  'P0001', 'invalid_duration', 'zero seconds is rejected'
);
select throws_ok(
  $$select public.send_letter('aaaaaaaa-0000-0000-0000-000000000002.m4a', 181, '10000000-0000-0000-0000-000000000002')$$,
  'P0001', 'invalid_duration', 'more than 180 seconds is rejected'
);
select throws_ok(
  $$select public.send_letter('aaaaaaaa-0000-0000-0000-000000000002.m4a', 60, '10000000-0000-0000-0000-000000000003')$$,
  'P0001', 'invalid_question', 'tomorrow''s question cannot be answered yet'
);
select throws_ok(
  $$select public.send_letter('aaaaaaaa-0000-0000-0000-000000000002.m4a', 60, '10000000-0000-0000-0000-000000000000')$$,
  'P0001', 'invalid_question', 'questions older than yesterday are closed'
);
select throws_ok(
  $$select public.send_letter('aaaaaaaa-0000-0000-0000-000000000002.m4a', 60, null)$$,
  'P0001', 'invalid_question', 'a new letter needs a question'
);
select isnt(
  public.send_letter('aaaaaaaa-0000-0000-0000-000000000002.m4a', 45, '10000000-0000-0000-0000-000000000001'),
  null,
  'yesterday''s question is still accepted (recording crossed midnight)'
);

-- friend letters
select isnt(
  public.send_letter('aaaaaaaa-0000-0000-0000-000000000003.m4a', 90, '10000000-0000-0000-0000-000000000002',
                     'friend', '00000000-0000-0000-0000-00000000000b'),
  null,
  'A can send a letter to their friend B'
);
select throws_ok(
  $$select public.send_letter('aaaaaaaa-0000-0000-0000-000000000004.m4a', 60, '10000000-0000-0000-0000-000000000002',
                              'friend', '00000000-0000-0000-0000-00000000000c')$$,
  'P0001', 'invalid_recipient', 'A cannot send a friend letter to a non-friend'
);
select throws_ok(
  $$select public.send_letter('aaaaaaaa-0000-0000-0000-000000000004.m4a', 60, '10000000-0000-0000-0000-000000000002',
                              'friend', null)$$,
  'P0001', 'invalid_recipient', 'a friend letter needs a recipient'
);

-- daily limit: 3 sent so far
select isnt(
  public.send_letter('aaaaaaaa-0000-0000-0000-000000000004.m4a', 30, '10000000-0000-0000-0000-000000000002'),
  null, 'fourth letter of the day is fine'
);
select isnt(
  public.send_letter('aaaaaaaa-0000-0000-0000-000000000005.m4a', 30, '10000000-0000-0000-0000-000000000002'),
  null, 'fifth letter of the day is fine'
);
select throws_ok(
  $$select public.send_letter('aaaaaaaa-0000-0000-0000-000000000006.m4a', 30, '10000000-0000-0000-0000-000000000002')$$,
  'P0001', 'daily_limit', 'the sixth letter of the day is refused'
);

reset role;

-- Server-set fields, checked as the owner (A cannot read recipient_id).
select is(
  (select count(*)::int from public.letters
   where sender_id = '00000000-0000-0000-0000-00000000000a'
     and deliver_after between created_at + interval '60 minutes' and created_at + interval '120 minutes'),
  5,
  'every letter is due 60–120 minutes after sending'
);
select is(
  (select count(*)::int from public.letters
   where sender_id = '00000000-0000-0000-0000-00000000000a'
     and recipient_type = 'stranger' and recipient_id is null),
  4,
  'stranger letters wait for the pool without a recipient'
);
select is(
  (select recipient_id from public.letters where audio_path = 'aaaaaaaa-0000-0000-0000-000000000003.m4a'),
  '00000000-0000-0000-0000-00000000000b'::uuid,
  'the friend letter is addressed to B'
);

-- ---------------------------------------------------------------------------
-- Replies (as B). Mark A's friend letter as delivered first.
-- ---------------------------------------------------------------------------

-- Letters pass through approved before delivered (stage 4 transition rule).
update public.letters set status = 'approved'
where audio_path in ('aaaaaaaa-0000-0000-0000-000000000003.m4a', 'aaaaaaaa-0000-0000-0000-000000000001.m4a');
update public.letters set status = 'delivered'
where audio_path = 'aaaaaaaa-0000-0000-0000-000000000003.m4a';

-- A stranger letter from A that B was given from the pool.
update public.letters
set recipient_id = '00000000-0000-0000-0000-00000000000b', status = 'delivered'
where audio_path = 'aaaaaaaa-0000-0000-0000-000000000001.m4a';

-- B cannot read letters addressed to them directly, so pass the ids in.
select set_config('test.friend_letter',
  (select id::text from public.letters where audio_path = 'aaaaaaaa-0000-0000-0000-000000000003.m4a'), true);
select set_config('test.stranger_letter',
  (select id::text from public.letters where audio_path = 'aaaaaaaa-0000-0000-0000-000000000001.m4a'), true);
select set_config('test.pending_letter',
  (select id::text from public.letters where audio_path = 'aaaaaaaa-0000-0000-0000-000000000004.m4a'), true);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

select isnt(
  public.send_letter('bbbbbbbb-0000-0000-0000-000000000001.m4a', 20,
                     p_reply_to_letter_id => current_setting('test.friend_letter')::uuid),
  null,
  'B can reply to a letter they received'
);
select isnt(
  public.send_letter('bbbbbbbb-0000-0000-0000-000000000002.m4a', 20,
                     p_reply_to_letter_id => current_setting('test.stranger_letter')::uuid),
  null,
  'B can reply to a stranger letter they received'
);
select throws_ok(
  $$select public.send_letter('bbbbbbbb-0000-0000-0000-000000000003.m4a', 20,
                              p_reply_to_letter_id => current_setting('test.pending_letter')::uuid)$$,
  'P0001', 'invalid_recipient', 'B cannot reply to a letter they never received'
);

reset role;

select results_eq(
  $$select recipient_id, recipient_type::text, question_id from public.letters
    where audio_path = 'bbbbbbbb-0000-0000-0000-000000000002.m4a'$$,
  $$values ('00000000-0000-0000-0000-00000000000a'::uuid, 'stranger', '10000000-0000-0000-0000-000000000002'::uuid)$$,
  'a reply to a stranger goes back to the original sender, still as a stranger, on the same question'
);

-- A blocks B: B can no longer reply to A.
insert into public.blocks (blocker_id, blocked_id)
values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b');
delete from public.letters where audio_path = 'bbbbbbbb-0000-0000-0000-000000000001.m4a';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok(
  $$select public.send_letter('bbbbbbbb-0000-0000-0000-000000000001.m4a', 20,
                              p_reply_to_letter_id => current_setting('test.friend_letter')::uuid)$$,
  'P0001', 'invalid_recipient', 'a blocked user cannot reply'
);

-- ---------------------------------------------------------------------------
-- Who may send at all
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok(
  $$select public.send_letter('cccccccc-0000-0000-0000-000000000001.m4a', 20, '10000000-0000-0000-0000-000000000002')$$,
  'P0001', 'not_allowed', 'a user without 18+ consent cannot send'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok(
  $$select public.send_letter('dddddddd-0000-0000-0000-000000000001.m4a', 20, '10000000-0000-0000-0000-000000000002')$$,
  'P0001', 'not_allowed', 'a banned user cannot send'
);

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok(
  $$select public.send_letter('aaaaaaaa-0000-0000-0000-000000000007.m4a', 20, '10000000-0000-0000-0000-000000000002')$$,
  '42501', null, 'anon cannot call send_letter'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('letters', 'eeeeeeee-0000-0000-0000-000000000004.m4a', null)$$,
  '42501', null, 'anon cannot upload'
);
reset role;

-- ---------------------------------------------------------------------------
-- rls_auto_enable is no longer callable through the API, but still works
-- ---------------------------------------------------------------------------

select ok(
  not has_function_privilege('anon', 'public.rls_auto_enable()', 'execute')
  and not has_function_privilege('authenticated', 'public.rls_auto_enable()', 'execute'),
  'rls_auto_enable is not executable by API roles'
);
create table public.rls_probe (id int);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.rls_probe'::regclass),
  'new public tables still get RLS automatically'
);

select * from finish();
rollback;
