-- Sesli Mektup: Row Level Security, grants and client-callable functions.
--
-- Approach: deny by default. RLS is on for every table; the app gets only the
-- policies and column grants listed here. Anything more sensitive (sending a
-- letter, reading a received letter without sender_id, blocking, friendships)
-- goes through security-definer functions added in later stages.

-- ---------------------------------------------------------------------------
-- Baseline: RLS on everywhere, no table access for anonymous clients.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.questions enable row level security;
alter table public.friendships enable row level security;
alter table public.letters enable row level security;
alter table public.listens enable row level security;
alter table public.reports enable row level security;
alter table public.blocks enable row level security;
alter table public.moderation_decisions enable row level security;

-- Supabase grants everything on new public tables to anon and authenticated by
-- default; take that back and hand out only what is needed below.
revoke all on
  public.profiles,
  public.questions,
  public.friendships,
  public.letters,
  public.listens,
  public.reports,
  public.blocks,
  public.moderation_decisions
from anon, authenticated;

grant usage on schema private to authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- profiles: a user sees and edits only their own row.
-- Friends' display names will be exposed through a function in stage 7.
-- is_banned and age_confirmed_at cannot be written directly.
-- ---------------------------------------------------------------------------

grant select on public.profiles to authenticated;
grant update (display_name, push_token) on public.profiles to authenticated;

create policy "profiles: read own"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "profiles: update own"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- questions: today's and earlier questions are readable; future ones are not.
-- ---------------------------------------------------------------------------

grant execute on function private.app_today() to authenticated;
grant select on public.questions to authenticated;

create policy "questions: read published"
  on public.questions for select
  to authenticated
  using (publish_date <= private.app_today());

-- ---------------------------------------------------------------------------
-- friendships: both sides can see the friendship. Creating and accepting
-- invites happens through functions in stage 7.
-- ---------------------------------------------------------------------------

grant select on public.friendships to authenticated;

create policy "friendships: read own"
  on public.friendships for select
  to authenticated
  using ((select auth.uid()) in (user_a, user_b));

-- ---------------------------------------------------------------------------
-- letters: a sender can read their own letters, but not who received them
-- (recipient_id) nor the moderator's internal reason (reject_reason).
-- Recipients read letters through a function that omits sender_id (stage 6).
-- Letters are created by a function that sets status and deliver_after (stage 4).
-- ---------------------------------------------------------------------------

grant select (
  id,
  sender_id,
  recipient_type,
  question_id,
  reply_to_letter_id,
  audio_path,
  duration_sec,
  status,
  created_at,
  deliver_after,
  delivered_at
) on public.letters to authenticated;

create policy "letters: sender reads own"
  on public.letters for select
  to authenticated
  using (sender_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- listens: a user sees their own listening history. Recording a listen
-- happens through a function in stage 6.
-- ---------------------------------------------------------------------------

grant select on public.listens to authenticated;

create policy "listens: read own"
  on public.listens for select
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- reports: a user can report a letter that was delivered to them, and see
-- their own reports. id, created_at and handled_at are set by the server.
-- ---------------------------------------------------------------------------

-- Security definer: the reporter cannot read received letters directly.
create function private.is_letter_recipient(p_letter_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.letters
    where id = p_letter_id
      and recipient_id = (select auth.uid())
      and status = 'delivered'
  );
$$;

revoke all on function private.is_letter_recipient(uuid) from public, anon;
grant execute on function private.is_letter_recipient(uuid) to authenticated;

alter table public.reports alter column reporter_id set default auth.uid();

grant select on public.reports to authenticated;
grant insert (reporter_id, letter_id, reason) on public.reports to authenticated;

create policy "reports: read own"
  on public.reports for select
  to authenticated
  using (reporter_id = (select auth.uid()));

create policy "reports: report a received letter"
  on public.reports for insert
  to authenticated
  with check (
    reporter_id = (select auth.uid())
    and private.is_letter_recipient(letter_id)
  );

-- ---------------------------------------------------------------------------
-- blocks: no direct access. blocked_id is the other user's id, which for a
-- stranger must never reach the client. Blocking and unblocking go through
-- functions that work from a letter id (stage 7).
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- moderation_decisions: no client access at all. Written only by the
-- moderation endpoint with the service role (stage 5).
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Client-callable functions
-- ---------------------------------------------------------------------------

-- Records the 18+ and rules consent. The time is set by the server and the
-- first confirmation is kept.
create function public.confirm_age()
returns timestamptz
language sql
volatile
security definer
set search_path = ''
as $$
  update public.profiles
  set age_confirmed_at = coalesce(age_confirmed_at, now())
  where id = (select auth.uid())
  returning age_confirmed_at;
$$;

revoke all on function public.confirm_age() from public, anon;
grant execute on function public.confirm_age() to authenticated;

-- The question of the day in Turkish time; empty if none is scheduled.
create function public.get_today_question()
returns setof public.questions
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from public.questions
  where publish_date = private.app_today()
  limit 1;
$$;

revoke all on function public.get_today_question() from public, anon;
grant execute on function public.get_today_question() to authenticated;
