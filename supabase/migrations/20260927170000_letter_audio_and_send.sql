-- Sesli Mektup stage 3: private audio storage and sending a letter.

-- ---------------------------------------------------------------------------
-- Storage: a private bucket for letter audio.
-- Files are named {uuid}.m4a with no user id in the path: the path is visible
-- in signed URLs, which strangers will receive in stage 6.
-- ~720 KB for 180 s at 32 kbps; 1 MB leaves headroom.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('letters', 'letters', false, 1048576, array['audio/mp4', 'audio/m4a', 'audio/x-m4a'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Upload only as yourself, only as a flat {uuid}.m4a name. No updates, so a
-- file cannot be swapped after moderation.
create policy "letters audio: upload own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'letters'
    and owner_id = (select auth.uid())::text
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.m4a$'
  );

-- The uploader can read (preview, signed URL) and delete their own files.
-- Recipients get access through a server-side signed URL in stage 6.
create policy "letters audio: owner reads"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'letters' and owner_id = (select auth.uid())::text);

create policy "letters audio: owner deletes"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'letters' and owner_id = (select auth.uid())::text);

-- One file belongs to one letter.
alter table public.letters add constraint letters_audio_path_key unique (audio_path);

-- ---------------------------------------------------------------------------
-- send_letter: the only way to create a letter.
-- The server decides status, delivery time and (for replies) the recipient;
-- the client only says what it recorded and to whom.
-- Errors are raised with a short machine-readable message the app maps to
-- Turkish text.
-- ---------------------------------------------------------------------------

create function public.send_letter(
  p_audio_path text,
  p_duration_sec integer,
  p_question_id uuid default null,
  p_recipient_type public.recipient_type default 'stranger',
  p_recipient_id uuid default null,
  p_reply_to_letter_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_sender uuid := (select auth.uid());
  v_today date := private.app_today();
  v_question_id uuid;
  v_recipient_id uuid;
  v_recipient_type public.recipient_type;
  v_original public.letters%rowtype;
  v_letter_id uuid;
begin
  if v_sender is null then
    raise exception 'not_allowed';
  end if;

  -- Serialize sends per user so the daily limit cannot be raced.
  perform pg_advisory_xact_lock(hashtextextended('send_letter:' || v_sender::text, 0));

  if not exists (
    select 1 from public.profiles
    where id = v_sender and not is_banned and age_confirmed_at is not null
  ) then
    raise exception 'not_allowed';
  end if;

  if p_duration_sec is null or p_duration_sec not between 1 and 180 then
    raise exception 'invalid_duration';
  end if;

  if not exists (
    select 1 from storage.objects
    where bucket_id = 'letters' and name = p_audio_path and owner_id = v_sender::text
  ) or exists (select 1 from public.letters where audio_path = p_audio_path) then
    raise exception 'invalid_audio';
  end if;

  -- At most 5 letters per Turkish calendar day.
  if (
    select count(*) from public.letters
    where sender_id = v_sender
      and created_at >= (v_today::timestamp at time zone 'Europe/Istanbul')
  ) >= 5 then
    raise exception 'daily_limit';
  end if;

  if p_reply_to_letter_id is not null then
    -- A reply goes back to whoever sent the original, in the same mode
    -- (a stranger stays a stranger), about the same question.
    select * into v_original
    from public.letters
    where id = p_reply_to_letter_id and recipient_id = v_sender and status = 'delivered';
    if not found then
      raise exception 'invalid_recipient';
    end if;
    v_recipient_id := v_original.sender_id;
    v_recipient_type := v_original.recipient_type;
    v_question_id := v_original.question_id;
  else
    -- Today's question; yesterday's is accepted for recordings that cross midnight.
    select id into v_question_id
    from public.questions
    where id = p_question_id and publish_date between v_today - 1 and v_today;
    if not found then
      raise exception 'invalid_question';
    end if;

    v_recipient_type := p_recipient_type;
    if v_recipient_type = 'friend' then
      if not exists (
        select 1 from public.friendships
        where status = 'accepted'
          and ((user_a = v_sender and user_b = p_recipient_id)
            or (user_b = v_sender and user_a = p_recipient_id))
      ) then
        raise exception 'invalid_recipient';
      end if;
      v_recipient_id := p_recipient_id;
    else
      -- Strangers are drawn from the pool later (stage 6).
      v_recipient_id := null;
    end if;
  end if;

  if v_recipient_id is not null and exists (
    select 1 from public.blocks
    where (blocker_id = v_sender and blocked_id = v_recipient_id)
       or (blocker_id = v_recipient_id and blocked_id = v_sender)
  ) then
    raise exception 'invalid_recipient';
  end if;

  insert into public.letters (
    sender_id, recipient_id, recipient_type, question_id, reply_to_letter_id,
    audio_path, duration_sec, status, deliver_after
  ) values (
    v_sender, v_recipient_id, v_recipient_type, v_question_id, p_reply_to_letter_id,
    p_audio_path, p_duration_sec, 'in_review',
    -- Random delay of 60–120 minutes (product rule).
    now() + make_interval(secs => 3600 + floor(random() * 3601))
  )
  returning id into v_letter_id;

  return v_letter_id;
end;
$$;

revoke all on function public.send_letter(text, integer, uuid, public.recipient_type, uuid, uuid)
  from public, anon;
grant execute on function public.send_letter(text, integer, uuid, public.recipient_type, uuid, uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Housekeeping: Supabase's automatic-RLS event trigger function lives in
-- public and is therefore exposed as an RPC. It only works as an event
-- trigger, so nobody needs to call it through the API.
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
