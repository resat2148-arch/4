-- Sesli Mektup stage 4: letter lifecycle.
--   in_review -> approved | rejected,  approved -> delivered
-- Moderation decisions are applied by private.apply_moderation_decision()
-- (called by the moderation endpoint in stage 5); a pg_cron job delivers
-- approved letters whose time has come.

-- ---------------------------------------------------------------------------
-- Status transitions are enforced here, whatever path the update takes.
-- The server stamps approved_at / delivered_at.
-- ---------------------------------------------------------------------------

create function private.enforce_letter_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if not (
      (old.status = 'in_review' and new.status in ('approved', 'rejected'))
      or (old.status = 'approved' and new.status = 'delivered')
    ) then
      raise exception 'invalid_status_transition: % -> %', old.status, new.status;
    end if;
    if new.status = 'approved' then
      new.approved_at := now();
    elsif new.status = 'delivered' then
      new.delivered_at := now();
    end if;
  end if;
  return new;
end;
$$;

create trigger letters_status_transition
  before update of status on public.letters
  for each row execute function private.enforce_letter_status();

-- ---------------------------------------------------------------------------
-- Moderation: record the decision in full and move the letter on.
-- Server-side only (service role); never callable from the app.
-- ---------------------------------------------------------------------------

create function private.apply_moderation_decision(
  p_letter_id uuid,
  p_decision public.moderation_decision,
  p_reason text,
  p_note text,
  p_decided_by text
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
  if v_status <> 'in_review' then
    raise exception 'already_decided';
  end if;

  update public.letters
  set status = p_decision::text::public.letter_status,
      -- Internal only: senders never see it (no column grant).
      reject_reason = case when p_decision = 'rejected' then p_reason end
  where id = p_letter_id;

  insert into public.moderation_decisions (letter_id, decision, reason, note, decided_by)
  values (p_letter_id, p_decision, p_reason, p_note, p_decided_by);
end;
$$;

revoke all on function private.apply_moderation_decision(uuid, public.moderation_decision, text, text, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Delivery: approved letters that have a recipient (friend letters and
-- replies) land in the recipient's mailbox once deliver_after has passed.
-- Stranger letters without a recipient stay approved: they form the pool,
-- from which a listener is given one in stage 6.
-- Letters from banned senders, or between people who have since blocked each
-- other, are silently held back.
-- ---------------------------------------------------------------------------

create function private.deliver_due_letters()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with due as (
    select l.id
    from public.letters l
    join public.profiles s on s.id = l.sender_id
    where l.status = 'approved'
      and l.recipient_id is not null
      and l.deliver_after <= now()
      and not s.is_banned
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = l.sender_id and b.blocked_id = l.recipient_id)
           or (b.blocker_id = l.recipient_id and b.blocked_id = l.sender_id)
      )
    for update of l skip locked
  )
  update public.letters l
  set status = 'delivered'
  from due
  where l.id = due.id;

  get diagnostics v_count = row_count;
  -- Stage 8: send push notifications for the letters delivered here.
  return v_count;
end;
$$;

revoke all on function private.deliver_due_letters() from public, anon, authenticated;

-- Every 5 minutes. Re-running this migration updates the job of the same name.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

select cron.schedule(
  'deliver-due-letters',
  '*/5 * * * *',
  $$select private.deliver_due_letters();$$
);

-- ---------------------------------------------------------------------------
-- The sender's "Yolda" list. Nothing about the recipient is returned, and a
-- delivered letter simply disappears: no "delivered" or "seen" signal.
--   on_the_way           in review, or approved and not yet due
--   waiting_for_stranger approved stranger letter in the pool
--   not_delivered        rejected in the last 7 days (shown without a reason)
-- Letters that are due but held back (blocks, bans) also disappear.
-- ---------------------------------------------------------------------------

create function public.get_my_outgoing_letters()
returns table (
  id uuid,
  recipient_type public.recipient_type,
  state text,
  deliver_after timestamptz,
  created_at timestamptz,
  duration_sec smallint
)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, l.recipient_type, s.state, l.deliver_after, l.created_at, l.duration_sec
  from public.letters l
  cross join lateral (
    select case
      when l.status = 'in_review' then 'on_the_way'
      when l.status = 'approved' and l.deliver_after > now() then 'on_the_way'
      when l.status = 'approved' and l.recipient_id is null then 'waiting_for_stranger'
      when l.status = 'rejected' and l.created_at > now() - interval '7 days' then 'not_delivered'
    end as state
  ) s
  where l.sender_id = (select auth.uid())
    and s.state is not null
  order by l.created_at desc;
$$;

revoke all on function public.get_my_outgoing_letters() from public, anon;
grant execute on function public.get_my_outgoing_letters() to authenticated;
