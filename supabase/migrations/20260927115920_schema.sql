-- Sesli Mektup: core schema.
-- Row Level Security and grants live in the next migration.

-- Helpers that must not be callable through the API live in `private`,
-- which PostgREST does not expose.
create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.question_intensity as enum ('light', 'deep');
create type public.friendship_status as enum ('pending', 'accepted');
create type public.recipient_type as enum ('stranger', 'friend');
create type public.letter_status as enum ('in_review', 'approved', 'rejected', 'delivered');
create type public.report_reason as enum ('harassment', 'inappropriate', 'personal_info', 'at_risk');
create type public.moderation_decision as enum ('approved', 'rejected');

-- The app's "day" follows Turkish time: the question of the day changes at
-- midnight Europe/Istanbul.
create function private.app_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Europe/Istanbul')::date;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Only ever shown to friends.
  display_name text check (display_name is null or char_length(btrim(display_name)) between 1 and 40),
  age_confirmed_at timestamptz,
  push_token text,
  is_banned boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  text text not null check (char_length(btrim(text)) between 1 and 300),
  publish_date date not null unique,
  intensity public.question_intensity not null default 'deep'
);

-- An invite starts as pending with only user_a (the inviter) and an invite code;
-- user_b is filled in when the code is redeemed.
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid references public.profiles (id) on delete cascade,
  status public.friendship_status not null default 'pending',
  invite_code text unique,
  created_at timestamptz not null default now(),
  check (user_b is null or user_b <> user_a),
  check (status = 'pending' or user_b is not null),
  check (status = 'accepted' or invite_code is not null)
);

-- One friendship per pair, regardless of who invited whom.
create unique index friendships_pair_key
  on public.friendships (least(user_a, user_b), greatest(user_a, user_b))
  where user_b is not null;
create index friendships_user_b_idx on public.friendships (user_b);

create table public.letters (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  -- Empty for a stranger letter until it is drawn from the pool.
  recipient_id uuid references public.profiles (id) on delete cascade,
  recipient_type public.recipient_type not null,
  question_id uuid not null references public.questions (id) on delete restrict,
  reply_to_letter_id uuid references public.letters (id) on delete set null,
  audio_path text not null,
  duration_sec smallint not null check (duration_sec between 1 and 180),
  status public.letter_status not null default 'in_review',
  reject_reason text,
  created_at timestamptz not null default now(),
  deliver_after timestamptz not null,
  approved_at timestamptz,
  delivered_at timestamptz,
  -- Product rule: delivery is delayed by 60–120 minutes.
  constraint letters_delivery_delay check (
    deliver_after between created_at + interval '60 minutes' and created_at + interval '120 minutes'
  ),
  constraint letters_friend_has_recipient check (recipient_type = 'stranger' or recipient_id is not null),
  constraint letters_not_to_self check (recipient_id is null or recipient_id <> sender_id),
  constraint letters_delivered_complete check (
    status <> 'delivered' or (recipient_id is not null and delivered_at is not null)
  )
);

create index letters_sender_idx on public.letters (sender_id, created_at desc);
create index letters_recipient_idx on public.letters (recipient_id, delivered_at desc);
create index letters_reply_to_idx on public.letters (reply_to_letter_id);
-- Scheduled delivery job: approved letters whose time has come.
create index letters_due_idx on public.letters (deliver_after) where status = 'approved';
-- Stranger pool: approved stranger letters nobody has been given yet.
create index letters_pool_idx on public.letters (created_at)
  where status = 'approved' and recipient_type = 'stranger' and recipient_id is null;

create table public.listens (
  user_id uuid not null references public.profiles (id) on delete cascade,
  letter_id uuid not null references public.letters (id) on delete cascade,
  -- Null until the letter has been listened to the end.
  completed_at timestamptz,
  primary key (user_id, letter_id)
);

create index listens_letter_idx on public.listens (letter_id);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  letter_id uuid not null references public.letters (id) on delete cascade,
  reason public.report_reason not null,
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  unique (reporter_id, letter_id)
);

create index reports_letter_idx on public.reports (letter_id);
create index reports_open_idx on public.reports (created_at) where handled_at is null;

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index blocks_blocked_idx on public.blocks (blocked_id);

-- Every moderation decision is kept in full; later used to evaluate automated
-- moderation. If the letter is deleted (account deletion) the decision stays,
-- detached from the letter.
create table public.moderation_decisions (
  id uuid primary key default gen_random_uuid(),
  letter_id uuid references public.letters (id) on delete set null,
  decision public.moderation_decision not null,
  reason text,
  note text,
  decided_by text not null,
  decided_at timestamptz not null default now()
);

create index moderation_decisions_letter_idx on public.moderation_decisions (letter_id);

-- ---------------------------------------------------------------------------
-- New users get a profile row automatically.
-- ---------------------------------------------------------------------------

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
