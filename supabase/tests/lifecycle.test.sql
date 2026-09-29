-- Letter lifecycle: status transitions, moderation, scheduled delivery and the
-- sender's outgoing list. Run with: npx supabase test db
begin;
select plan(25);

-- ---------------------------------------------------------------------------
-- Fixtures (as the migration owner)
-- A sends; B is A's friend; C got a reply from A but has blocked A since;
-- D is banned. Letters created 2 hours ago are due (deliver_after 90 min).
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'c@test.local'),
  ('00000000-0000-0000-0000-00000000000d', 'd@test.local');
update public.profiles set age_confirmed_at = now();
update public.profiles set is_banned = true where id = '00000000-0000-0000-0000-00000000000d';

delete from public.questions;
insert into public.questions (id, text, publish_date)
values ('10000000-0000-0000-0000-000000000002', 'bugün', private.app_today());

insert into public.blocks (blocker_id, blocked_id)
values ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000a');

insert into public.letters
  (id, sender_id, recipient_id, recipient_type, question_id, audio_path, duration_sec, created_at, deliver_after)
select v.id::uuid, v.sender::uuid, v.recipient::uuid, v.kind::public.recipient_type,
       '10000000-0000-0000-0000-000000000002', v.id || '.m4a', 30, v.created, v.created + interval '90 minutes'
from (values
  -- L1 friend letter, due
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'friend', now() - interval '2 hours'),
  -- L2 friend letter, not due yet
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'friend', now()),
  -- L3 stranger letter, due (goes to the pool)
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000a', null, 'stranger', now() - interval '2 hours'),
  -- L4 stranger letter, not due yet
  ('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000000a', null, 'stranger', now()),
  -- L5 friend letter from banned D, due
  ('20000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000b', 'friend', now() - interval '2 hours'),
  -- L6 reply from A to C, who has blocked A since, due
  ('20000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000c', 'stranger', now() - interval '2 hours'),
  -- L7 will be rejected
  ('20000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-00000000000a', null, 'stranger', now() - interval '2 hours'),
  -- L8 rejected long ago
  ('20000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-00000000000a', null, 'stranger', now() - interval '8 days')
) as v(id, sender, recipient, kind, created);

-- ---------------------------------------------------------------------------
-- Who may run moderation and delivery
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok(
  $$select private.apply_moderation_decision('20000000-0000-0000-0000-000000000001', 'approved', null, null, 'me')$$,
  '42501', null, 'the app cannot approve letters'
);
select throws_ok('select private.deliver_due_letters()', '42501', null, 'the app cannot trigger delivery');
reset role;

-- ---------------------------------------------------------------------------
-- Transitions and moderation
-- ---------------------------------------------------------------------------

select throws_like(
  $$update public.letters set status = 'delivered' where id = '20000000-0000-0000-0000-000000000001'$$,
  'invalid_status_transition%', 'a letter cannot skip moderation'
);

select lives_ok(
  $$select private.apply_moderation_decision('20000000-0000-0000-0000-000000000001', 'approved', null, 'iyi', 'moderator-1')$$,
  'a letter can be approved'
);
select results_eq(
  $$select status::text, approved_at is not null from public.letters where id = '20000000-0000-0000-0000-000000000001'$$,
  $$values ('approved', true)$$,
  'approval sets the status and approved_at'
);
select results_eq(
  $$select decision::text, note, decided_by from public.moderation_decisions where letter_id = '20000000-0000-0000-0000-000000000001'$$,
  $$values ('approved', 'iyi', 'moderator-1')$$,
  'the decision is recorded in full'
);
select throws_ok(
  $$select private.apply_moderation_decision('20000000-0000-0000-0000-000000000001', 'rejected', null, null, 'moderator-2')$$,
  'P0001', 'already_decided', 'a letter is decided only once'
);
select throws_ok(
  $$select private.apply_moderation_decision('20000000-0000-0000-0000-000000000002', 'approved', null, null, ' ')$$,
  'P0001', 'decided_by_required', 'every decision names who made it'
);
select throws_ok(
  $$select private.apply_moderation_decision('29999999-0000-0000-0000-000000000000', 'approved', null, null, 'moderator-1')$$,
  'P0001', 'letter_not_found', 'an unknown letter is reported'
);

select lives_ok(
  $$select private.apply_moderation_decision('20000000-0000-0000-0000-000000000007', 'rejected', 'personal_info', 'telefon numarası', 'moderator-1')$$,
  'a letter can be rejected'
);
select results_eq(
  $$select status::text, reject_reason from public.letters where id = '20000000-0000-0000-0000-000000000007'$$,
  $$values ('rejected', 'personal_info')$$,
  'rejection keeps the internal reason'
);
select throws_like(
  $$update public.letters set status = 'approved' where id = '20000000-0000-0000-0000-000000000007'$$,
  'invalid_status_transition%', 'a rejected letter stays rejected'
);

select private.apply_moderation_decision(id, 'approved', null, null, 'moderator-1')
from public.letters
where id in ('20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003',
             '20000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000005',
             '20000000-0000-0000-0000-000000000006');
select private.apply_moderation_decision('20000000-0000-0000-0000-000000000008', 'rejected', 'other', null, 'moderator-1');

-- ---------------------------------------------------------------------------
-- Scheduled delivery
-- ---------------------------------------------------------------------------

select is(private.deliver_due_letters(), 1, 'one letter is due for delivery');
select results_eq(
  $$select status::text, delivered_at is not null from public.letters where id = '20000000-0000-0000-0000-000000000001'$$,
  $$values ('delivered', true)$$,
  'the due friend letter is delivered'
);
select is(
  (select status::text from public.letters where id = '20000000-0000-0000-0000-000000000002'),
  'approved', 'a letter is not delivered before its time'
);
select results_eq(
  $$select status::text, recipient_id from public.letters where id = '20000000-0000-0000-0000-000000000003'$$,
  $$values ('approved', null::uuid)$$,
  'a due stranger letter waits in the pool'
);
select is(
  (select status::text from public.letters where id = '20000000-0000-0000-0000-000000000005'),
  'approved', 'letters from a banned sender are held back'
);
select is(
  (select status::text from public.letters where id = '20000000-0000-0000-0000-000000000006'),
  'approved', 'letters between people who blocked each other are held back'
);
select is(private.deliver_due_letters(), 0, 'running delivery again changes nothing');
select throws_like(
  $$update public.letters set status = 'approved' where id = '20000000-0000-0000-0000-000000000001'$$,
  'invalid_status_transition%', 'a delivered letter stays delivered'
);
select is(
  (select count(*)::int from cron.job where jobname = 'deliver-due-letters' and schedule = '*/5 * * * *'),
  1, 'delivery is scheduled every 5 minutes'
);

-- ---------------------------------------------------------------------------
-- The sender's outgoing list
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select set_eq(
  $$select id::text, state from public.get_my_outgoing_letters()$$,
  $$values ('20000000-0000-0000-0000-000000000002', 'on_the_way'),
           ('20000000-0000-0000-0000-000000000003', 'waiting_for_stranger'),
           ('20000000-0000-0000-0000-000000000004', 'on_the_way'),
           ('20000000-0000-0000-0000-000000000007', 'not_delivered')$$,
  'A sees letters on the way, waiting in the pool and recently not delivered; delivered, held back and old ones are gone'
);
select ok(
  pg_get_function_result('public.get_my_outgoing_letters()'::regprocedure) !~ 'recipient_id|reject_reason|sender_id',
  'the outgoing list returns nothing about the recipient or the moderator''s reason'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.get_my_outgoing_letters()), 0, 'B sees none of A''s letters');

reset role;
set local role anon;
select throws_ok('select * from public.get_my_outgoing_letters()', '42501', null, 'anon cannot read outgoing letters');
reset role;

select * from finish();
rollback;
