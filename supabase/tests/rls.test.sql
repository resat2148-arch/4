-- RLS and grant tests. Run with: npx supabase test db
begin;
select plan(38);

-- ---------------------------------------------------------------------------
-- Fixtures (as the migration owner)
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'c@test.local');

select is(
  (select count(*)::int from public.profiles
   where id in ('00000000-0000-0000-0000-00000000000a',
                '00000000-0000-0000-0000-00000000000b',
                '00000000-0000-0000-0000-00000000000c')),
  3,
  'a profile is created for every new auth user'
);

delete from public.questions;
insert into public.questions (id, text, publish_date) values
  ('10000000-0000-0000-0000-000000000001', 'dün', private.app_today() - 1),
  ('10000000-0000-0000-0000-000000000002', 'bugün', private.app_today()),
  ('10000000-0000-0000-0000-000000000003', 'yarın', private.app_today() + 1);

-- L1: A -> B (friend), delivered. L2: A -> stranger pool. L3: B -> C, delivered.
insert into public.letters
  (id, sender_id, recipient_id, recipient_type, question_id, audio_path, duration_sec,
   status, reject_reason, deliver_after, delivered_at)
values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a',
   '00000000-0000-0000-0000-00000000000b', 'friend', '10000000-0000-0000-0000-000000000002',
   'a/1.m4a', 60, 'delivered', null, now() + interval '90 minutes', now()),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a',
   null, 'stranger', '10000000-0000-0000-0000-000000000002',
   'a/2.m4a', 120, 'rejected', 'internal moderator note', now() + interval '60 minutes', null),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000b',
   '00000000-0000-0000-0000-00000000000c', 'friend', '10000000-0000-0000-0000-000000000002',
   'b/3.m4a', 30, 'delivered', null, now() + interval '120 minutes', now());

insert into public.friendships (user_a, user_b, status, invite_code) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'accepted', null);

insert into public.moderation_decisions (letter_id, decision, decided_by)
values ('20000000-0000-0000-0000-000000000001', 'approved', 'test');

-- ---------------------------------------------------------------------------
-- Table constraints
-- ---------------------------------------------------------------------------

select throws_ok(
  $$insert into public.letters (sender_id, recipient_type, question_id, audio_path, duration_sec, deliver_after)
    values ('00000000-0000-0000-0000-00000000000a', 'stranger', '10000000-0000-0000-0000-000000000002',
            'x.m4a', 30, now() + interval '10 minutes')$$,
  '23514', null,
  'delivery earlier than 60 minutes is rejected'
);

select throws_ok(
  $$insert into public.letters (sender_id, recipient_type, question_id, audio_path, duration_sec, deliver_after)
    values ('00000000-0000-0000-0000-00000000000a', 'stranger', '10000000-0000-0000-0000-000000000002',
            'x.m4a', 181, now() + interval '90 minutes')$$,
  '23514', null,
  'letters longer than 180 seconds are rejected'
);

select throws_ok(
  $$insert into public.letters (sender_id, recipient_type, question_id, audio_path, duration_sec, deliver_after)
    values ('00000000-0000-0000-0000-00000000000a', 'friend', '10000000-0000-0000-0000-000000000002',
            'x.m4a', 30, now() + interval '90 minutes')$$,
  '23514', null,
  'a friend letter needs a recipient'
);

select throws_ok(
  $$insert into public.friendships (user_a, user_b, status)
    values ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a', 'accepted')$$,
  '23505', null,
  'only one friendship per pair, whoever invited'
);

-- ---------------------------------------------------------------------------
-- Anonymous clients
-- ---------------------------------------------------------------------------

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok('select * from public.questions', '42501', null, 'anon cannot read questions');
select throws_ok('select * from public.profiles', '42501', null, 'anon cannot read profiles');
select throws_ok('select public.confirm_age()', '42501', null, 'anon cannot call confirm_age');
select throws_ok('select * from public.get_today_question()', '42501', null, 'anon cannot call get_today_question');

reset role;

-- ---------------------------------------------------------------------------
-- User A
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

-- profiles
select is((select count(*)::int from public.profiles), 1, 'A sees only their own profile');
select lives_ok($$update public.profiles set display_name = 'Ayşe'$$, 'A can set their display name');
select is(
  (select count(*)::int from public.profiles where display_name = 'Ayşe'),
  1,
  'display name was saved'
);
select throws_ok('update public.profiles set is_banned = false', '42501', null, 'A cannot touch is_banned');
select throws_ok('update public.profiles set age_confirmed_at = now()', '42501', null,
  'A cannot write age_confirmed_at directly');
select throws_ok(
  $$insert into public.profiles (id) values ('00000000-0000-0000-0000-0000000000ff')$$,
  '42501', null, 'A cannot insert profiles');
select throws_ok('delete from public.profiles', '42501', null, 'A cannot delete profiles');

select isnt(public.confirm_age(), null, 'confirm_age records the consent time');
select is(
  public.confirm_age(),
  (select age_confirmed_at from public.profiles),
  'confirm_age keeps the first confirmation'
);

-- questions
select is((select count(*)::int from public.questions), 2, 'A sees today''s and past questions only');
select is(
  (select text from public.get_today_question()),
  'bugün',
  'get_today_question returns today''s question'
);
select throws_ok($$insert into public.questions (text, publish_date) values ('x', '2030-01-01')$$,
  '42501', null, 'A cannot add questions');

-- letters
select is(
  (select count(*)::int from public.letters),
  2,
  'A sees only the letters A sent'
);
select is(
  (select status::text from public.letters where id = '20000000-0000-0000-0000-000000000002'),
  'rejected',
  'A can see that a letter was rejected'
);
select throws_ok('select recipient_id from public.letters', '42501', null,
  'A cannot see who received their letters');
select throws_ok('select reject_reason from public.letters', '42501', null,
  'A cannot see the moderator''s internal reason');
select throws_ok(
  $$insert into public.letters (sender_id, recipient_type, question_id, audio_path, duration_sec, deliver_after)
    values ('00000000-0000-0000-0000-00000000000a', 'stranger', '10000000-0000-0000-0000-000000000002',
            'x.m4a', 30, now() + interval '90 minutes')$$,
  '42501', null, 'A cannot insert letters directly');
select throws_ok($$update public.letters set status = 'delivered'$$, '42501', null,
  'A cannot change letter status');

-- reports: L3 was not delivered to A
select throws_ok(
  $$insert into public.reports (letter_id, reason) values ('20000000-0000-0000-0000-000000000003', 'harassment')$$,
  '42501', null, 'A cannot report a letter they did not receive');

-- friendships
select is((select count(*)::int from public.friendships), 1, 'A sees their friendship');
select throws_ok(
  $$insert into public.friendships (user_a, invite_code) values ('00000000-0000-0000-0000-00000000000a', 'abc')$$,
  '42501', null, 'A cannot create friendships directly');

-- listens, blocks, moderation
select is((select count(*)::int from public.listens), 0, 'A can read their (empty) listening history');
select throws_ok('select * from public.blocks', '42501', null, 'blocks are not readable directly');
select throws_ok('select * from public.moderation_decisions', '42501', null,
  'moderation decisions are not readable');

reset role;

-- ---------------------------------------------------------------------------
-- User B (recipient of L1)
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

select is(
  (select count(*)::int from public.letters where id = '20000000-0000-0000-0000-000000000001'),
  0,
  'a recipient cannot read a received letter (and its sender_id) directly'
);
select lives_ok(
  $$insert into public.reports (letter_id, reason) values ('20000000-0000-0000-0000-000000000001', 'harassment')$$,
  'B can report a letter delivered to them'
);
select throws_ok(
  $$insert into public.reports (reporter_id, letter_id, reason)
    values ('00000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-000000000001', 'harassment')$$,
  '42501', null, 'B cannot file a report in someone else''s name');

reset role;

-- ---------------------------------------------------------------------------
-- User C
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);

select is((select count(*)::int from public.friendships), 0, 'C does not see others'' friendships');
select is((select count(*)::int from public.reports), 0, 'C does not see others'' reports');

reset role;

select * from finish();
rollback;
