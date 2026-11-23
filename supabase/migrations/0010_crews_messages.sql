-- Match&Play — этап 10: команды, групповые и личные чаты, вызовы между командами
-- Запускать после 0009_checkin_feed.sql

-- ═════════════ Команды ═════════════

create table public.crews (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(btrim(name)) between 3 and 30),
  description   text check (char_length(description) <= 200),
  sport         text not null check (sport in ('football','basketball','volleyball','tennis','padel','hockey','table_tennis','badminton','running','other')),
  city_id       smallint not null references public.cities (id),
  captain_id    uuid not null references public.profiles (id),
  is_open       boolean not null default true,
  member_count  smallint not null default 0 check (member_count >= 0),
  created_at    timestamptz not null default now()
);

create unique index crews_name_key on public.crews (lower(btrim(name)));
create index crews_city_idx on public.crews (city_id, member_count desc);
create index crews_captain_idx on public.crews (captain_id);

create table public.crew_members (
  crew_id    uuid not null references public.crews (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       text not null default 'member' check (role in ('captain', 'member')),
  -- removed: капитан убрал или отклонил, повторно вступить нельзя
  status     text not null default 'active' check (status in ('pending', 'active', 'removed')),
  joined_at  timestamptz not null default now(),
  primary key (crew_id, user_id)
);

create index crew_members_user_idx on public.crew_members (user_id, status);
create index crew_members_crew_idx on public.crew_members (crew_id, status, joined_at);

create or replace function public.is_crew_member(p_crew_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.crew_members m
                  where m.crew_id = p_crew_id and m.user_id = p_user_id and m.status = 'active');
$$;

create or replace function public.is_crew_captain(p_crew_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.crews c where c.id = p_crew_id and c.captain_id = p_user_id);
$$;

alter table public.crews enable row level security;
alter table public.crew_members enable row level security;
create policy "crews: читают вошедшие" on public.crews for select to authenticated using (true);
create policy "crew_members: состав и свои заявки" on public.crew_members
  for select to authenticated using (
    status = 'active' or user_id = auth.uid() or public.is_crew_captain(crew_id, auth.uid())
  );
-- Менять команды можно только через функции ниже.

-- ═════════════ Чаты ═════════════

create table public.conversations (
  id               uuid primary key default gen_random_uuid(),
  kind             text not null check (kind in ('crew', 'direct')),
  crew_id          uuid unique references public.crews (id) on delete cascade,
  -- Для личного чата: два id по порядку, чтобы у пары был только один диалог
  direct_key       text unique,
  last_message_at  timestamptz,
  created_at       timestamptz not null default now(),
  constraint conversations_shape_check check (
    (kind = 'crew' and crew_id is not null and direct_key is null)
    or (kind = 'direct' and crew_id is null and direct_key is not null)
  )
);

create table public.conversation_members (
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  last_read_at     timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conversation_members_user_idx on public.conversation_members (user_id);

create table public.chat_messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  text             text not null check (char_length(btrim(text)) between 1 and 1000),
  created_at       timestamptz not null default now()
);
create index chat_messages_conversation_idx on public.chat_messages (conversation_id, created_at desc);
create index chat_messages_user_idx on public.chat_messages (user_id, created_at desc);

create or replace function public.is_conversation_member(p_conversation_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.conversation_members m
                  where m.conversation_id = p_conversation_id and m.user_id = p_user_id);
$$;

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.chat_messages enable row level security;

create policy "conversations: свои" on public.conversations
  for select to authenticated using (public.is_conversation_member(id, auth.uid()));
create policy "conversation_members: свои чаты" on public.conversation_members
  for select to authenticated using (public.is_conversation_member(conversation_id, auth.uid()));
create policy "chat_messages: читают участники" on public.chat_messages
  for select to authenticated using (
    public.is_conversation_member(conversation_id, auth.uid())
    and not public.is_blocked_between(auth.uid(), user_id)
  );
create policy "chat_messages: пишут участники" on public.chat_messages
  for insert to authenticated with check (
    auth.uid() = user_id and public.is_conversation_member(conversation_id, auth.uid())
  );

-- Состав чата команды и счётчик участников следуют за составом команды
create or replace function public.sync_crew_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_crew uuid := coalesce(new.crew_id, old.crew_id);
  v_user uuid := coalesce(new.user_id, old.user_id);
  v_conversation uuid;
begin
  select id into v_conversation from public.conversations where crew_id = v_crew;

  if tg_op <> 'DELETE' and new.status = 'active' then
    if v_conversation is not null then
      insert into public.conversation_members (conversation_id, user_id)
      values (v_conversation, v_user) on conflict do nothing;
    end if;
  elsif v_conversation is not null then
    delete from public.conversation_members where conversation_id = v_conversation and user_id = v_user;
  end if;

  update public.crews
     set member_count = (select count(*) from public.crew_members m where m.crew_id = v_crew and m.status = 'active')
   where id = v_crew;
  return null;
end;
$$;

create trigger crew_members_sync
  after insert or update of status or delete on public.crew_members
  for each row execute function public.sync_crew_member();

-- Проверка перед отправкой: блокировка в личном чате и защита от спама
create or replace function public.guard_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
begin
  select kind into v_kind from public.conversations where id = new.conversation_id;
  if v_kind = 'direct' and exists (
    select 1 from public.conversation_members m
     where m.conversation_id = new.conversation_id and m.user_id <> new.user_id
       and public.is_blocked_between(m.user_id, new.user_id)
  ) then
    raise exception 'user_blocked' using errcode = 'P0001';
  end if;
  if (select count(*) from public.chat_messages m
       where m.user_id = new.user_id and m.created_at > now() - interval '1 minute') >= 30 then
    raise exception 'too_many_messages' using errcode = 'P0001';
  end if;
  new.created_at := now();
  return new;
end;
$$;

create trigger chat_messages_guard
  before insert on public.chat_messages
  for each row execute function public.guard_chat_message();

-- После отправки: время последнего сообщения и уведомления без спама
create or replace function public.on_conversation_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation public.conversations;
  v_type text;
  v_payload jsonb;
  v_member uuid;
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id
  returning * into v_conversation;
  update public.conversation_members set last_read_at = new.created_at
   where conversation_id = new.conversation_id and user_id = new.user_id;

  v_type := case when v_conversation.kind = 'crew' then 'crew_message' else 'direct_message' end;
  select jsonb_build_object(
           'conversation_id', new.conversation_id,
           'actor', p.username,
           'actor_avatar', p.avatar_url,
           'text', left(new.text, 120),
           'crew_id', c.id,
           'crew_name', c.name
         )
    into v_payload
    from public.profiles p
    left join public.crews c on c.id = v_conversation.crew_id
   where p.id = new.user_id;

  for v_member in
    select m.user_id from public.conversation_members m
     where m.conversation_id = new.conversation_id and m.user_id <> new.user_id
  loop
    continue when public.is_blocked_between(v_member, new.user_id);
    continue when exists (
      select 1 from public.notifications n
       where n.user_id = v_member and n.type = v_type and not n.read
         and n.payload->>'conversation_id' = new.conversation_id::text
         and n.created_at > now() - interval '15 minutes'
    );
    perform public.notify(v_member, v_type, v_payload);
  end loop;
  return null;
end;
$$;

create trigger chat_messages_after
  after insert on public.chat_messages
  for each row execute function public.on_conversation_message();

-- Написать первым можно тому, кто подписан на вас, или с кем вы были в одной команде или игре
create or replace function public.can_message(p_from uuid, p_to uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_from is not null and p_from <> p_to
     and not public.is_blocked_between(p_from, p_to)
     and (
       exists (select 1 from public.follows f where f.follower_id = p_to and f.following_id = p_from)
       or exists (select 1 from public.conversations c
                   where c.direct_key = least(p_from::text, p_to::text) || ':' || greatest(p_from::text, p_to::text))
       or exists (select 1 from public.crew_members a
                    join public.crew_members b on b.crew_id = a.crew_id
                   where a.user_id = p_from and b.user_id = p_to and a.status = 'active' and b.status = 'active')
       or exists (
         with roster as (
           select l.id as lobby_id, l.organizer_id as user_id from public.lobbies l where l.status <> 'cancelled'
           union all
           select a.lobby_id, a.user_id from public.lobby_applications a
             join public.lobbies l on l.id = a.lobby_id
            where a.status = 'accepted' and l.status <> 'cancelled'
         )
         select 1 from roster x join roster y on y.lobby_id = x.lobby_id
          where x.user_id = p_from and y.user_id = p_to
       )
     );
$$;

create or replace function public.start_direct_chat(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_key text;
  v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if not public.can_message(v_uid, p_user_id) then raise exception 'cannot_message' using errcode = 'P0001'; end if;

  v_key := least(v_uid::text, p_user_id::text) || ':' || greatest(v_uid::text, p_user_id::text);
  insert into public.conversations (kind, direct_key) values ('direct', v_key)
  on conflict (direct_key) do update set direct_key = excluded.direct_key
  returning id into v_id;

  insert into public.conversation_members (conversation_id, user_id)
  values (v_id, v_uid), (v_id, p_user_id)
  on conflict do nothing;
  return v_id;
end;
$$;

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversation_members set last_read_at = now()
   where conversation_id = p_conversation_id and user_id = auth.uid();
  update public.notifications set read = true
   where user_id = auth.uid() and not read
     and type in ('crew_message', 'direct_message')
     and payload->>'conversation_id' = p_conversation_id::text;
end;
$$;

-- Список чатов одним запросом: собеседник или команда, последнее сообщение, непрочитанные
create or replace function public.get_my_conversations()
returns setof jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
           'id', c.id,
           'kind', c.kind,
           'crew', case when cr.id is null then null else jsonb_build_object('id', cr.id, 'name', cr.name, 'sport', cr.sport, 'member_count', cr.member_count) end,
           'other', case when other.id is null then null else jsonb_build_object('id', other.id, 'username', other.username, 'full_name', other.full_name, 'avatar_url', other.avatar_url) end,
           'last_text', last_msg.text,
           'last_user_id', last_msg.user_id,
           'last_at', coalesce(last_msg.created_at, c.created_at),
           'unread', (
             select count(*) from public.chat_messages m
              where m.conversation_id = c.id and m.created_at > me.last_read_at and m.user_id <> me.user_id
                and not public.is_blocked_between(me.user_id, m.user_id)
           )
         )
    from public.conversation_members me
    join public.conversations c on c.id = me.conversation_id
    left join public.crews cr on cr.id = c.crew_id
    left join lateral (
      select p.* from public.conversation_members x
        join public.profiles p on p.id = x.user_id
       where c.kind = 'direct' and x.conversation_id = c.id and x.user_id <> me.user_id
       limit 1
    ) other on true
    left join lateral (
      select m.text, m.user_id, m.created_at from public.chat_messages m
       where m.conversation_id = c.id and not public.is_blocked_between(me.user_id, m.user_id)
       order by m.created_at desc limit 1
    ) last_msg on true
   where me.user_id = auth.uid()
     and (c.kind = 'crew' or (other.id is not null and not public.is_blocked_between(me.user_id, other.id)))
     -- Пустой личный диалог не показываем, пока кто-нибудь не напишет
     and (c.kind = 'crew' or last_msg.created_at is not null)
   order by coalesce(last_msg.created_at, c.created_at) desc
   limit 100;
$$;

create or replace function public.unread_chat_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
    from public.conversation_members me
   where me.user_id = auth.uid()
     and exists (
       select 1 from public.chat_messages m
        where m.conversation_id = me.conversation_id and m.created_at > me.last_read_at and m.user_id <> me.user_id
          and not public.is_blocked_between(me.user_id, m.user_id)
     );
$$;

-- ═════════════ Управление командой ═════════════

create or replace function public.create_crew(p_name text, p_description text, p_sport text, p_city_id smallint, p_is_open boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if (select count(*) from public.crews where captain_id = v_uid) >= 5 then
    raise exception 'too_many_crews' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.crews where lower(btrim(name)) = lower(v_name)) then
    raise exception 'crew_name_taken' using errcode = 'P0001';
  end if;

  insert into public.crews (name, description, sport, city_id, captain_id, is_open)
  values (v_name, nullif(btrim(coalesce(p_description, '')), ''), p_sport, p_city_id, v_uid, coalesce(p_is_open, true))
  returning id into v_id;
  insert into public.conversations (kind, crew_id) values ('crew', v_id);
  insert into public.crew_members (crew_id, user_id, role, status) values (v_id, v_uid, 'captain', 'active');
  return v_id;
end;
$$;

create or replace function public.join_crew(p_crew_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_crew public.crews;
  v_status text;
  v_new text;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  select * into v_crew from public.crews where id = p_crew_id for update;
  if not found then raise exception 'crew_not_found' using errcode = 'P0001'; end if;

  select status into v_status from public.crew_members where crew_id = p_crew_id and user_id = v_uid;
  if v_status = 'removed' then raise exception 'crew_removed' using errcode = 'P0001'; end if;
  if v_status is not null then return v_status; end if;
  if public.is_blocked_between(v_uid, v_crew.captain_id) then raise exception 'user_blocked' using errcode = 'P0001'; end if;
  if v_crew.member_count >= 50 then raise exception 'crew_full' using errcode = 'P0001'; end if;

  v_new := case when v_crew.is_open then 'active' else 'pending' end;
  insert into public.crew_members (crew_id, user_id, status) values (p_crew_id, v_uid, v_new);

  perform public.notify(v_crew.captain_id,
    case when v_new = 'active' then 'crew_member_joined' else 'crew_join_request' end,
    (select jsonb_build_object('crew_id', v_crew.id, 'crew_name', v_crew.name, 'actor', p.username, 'actor_avatar', p.avatar_url)
       from public.profiles p where p.id = v_uid));
  return v_new;
end;
$$;

-- Передать капитанство самому давнему участнику; если никого нет, команда удаляется
create or replace function public.hand_over_crew(p_crew_id uuid, p_leaving uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next uuid;
begin
  select user_id into v_next from public.crew_members
   where crew_id = p_crew_id and user_id <> p_leaving and status = 'active'
   order by joined_at, user_id limit 1;
  if v_next is null then
    delete from public.crews where id = p_crew_id;
  else
    update public.crews set captain_id = v_next where id = p_crew_id;
    update public.crew_members set role = 'captain' where crew_id = p_crew_id and user_id = v_next;
    perform public.notify(v_next, 'crew_captain',
      (select jsonb_build_object('crew_id', c.id, 'crew_name', c.name) from public.crews c where c.id = p_crew_id));
  end if;
end;
$$;

create or replace function public.leave_crew(p_crew_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_captain uuid;
begin
  select captain_id into v_captain from public.crews where id = p_crew_id for update;
  if not found then raise exception 'crew_not_found' using errcode = 'P0001'; end if;
  if v_captain = v_uid then perform public.hand_over_crew(p_crew_id, v_uid); end if;
  delete from public.crew_members where crew_id = p_crew_id and user_id = v_uid and status <> 'removed';
end;
$$;

create or replace function public.decide_crew_member(p_crew_id uuid, p_user_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_crew public.crews;
begin
  select * into v_crew from public.crews where id = p_crew_id for update;
  if not found or v_crew.captain_id is distinct from auth.uid() then raise exception 'not_captain' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.crew_members where crew_id = p_crew_id and user_id = p_user_id and status = 'pending') then
    raise exception 'already_decided' using errcode = 'P0001';
  end if;
  if p_accept and v_crew.member_count >= 50 then raise exception 'crew_full' using errcode = 'P0001'; end if;

  update public.crew_members
     set status = case when p_accept then 'active' else 'removed' end, joined_at = now()
   where crew_id = p_crew_id and user_id = p_user_id;
  perform public.notify(p_user_id, case when p_accept then 'crew_accepted' else 'crew_rejected' end,
    jsonb_build_object('crew_id', v_crew.id, 'crew_name', v_crew.name));
end;
$$;

create or replace function public.remove_crew_member(p_crew_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_crew public.crews;
begin
  select * into v_crew from public.crews where id = p_crew_id for update;
  if not found or v_crew.captain_id is distinct from auth.uid() then raise exception 'not_captain' using errcode = 'P0001'; end if;
  if p_user_id = v_crew.captain_id then raise exception 'cannot_remove_captain' using errcode = 'P0001'; end if;
  update public.crew_members set status = 'removed' where crew_id = p_crew_id and user_id = p_user_id and status = 'active';
  if not found then raise exception 'not_member' using errcode = 'P0001'; end if;
  perform public.notify(p_user_id, 'crew_removed', jsonb_build_object('crew_id', v_crew.id, 'crew_name', v_crew.name));
end;
$$;

-- При удалении аккаунта команда не должна остаться без капитана
create or replace function public.before_profile_delete_crews()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_crew uuid;
begin
  for v_crew in select id from public.crews where captain_id = old.id loop
    perform public.hand_over_crew(v_crew, old.id);
  end loop;
  return old;
end;
$$;

create trigger profiles_hand_over_crews
  before delete on public.profiles
  for each row execute function public.before_profile_delete_crews();

-- ═════════════ Вызовы между командами ═════════════

create table public.crew_challenges (
  id             uuid primary key default gen_random_uuid(),
  from_crew_id   uuid not null references public.crews (id) on delete cascade,
  to_crew_id     uuid not null references public.crews (id) on delete cascade,
  created_by     uuid references public.profiles (id) on delete set null,
  sport          text not null,
  start_time     timestamptz not null,
  duration_min   smallint not null default 90 check (duration_min between 15 and 600),
  city_id        smallint not null references public.cities (id),
  location_name  text not null check (char_length(btrim(location_name)) between 2 and 120),
  team_size      smallint not null check (team_size between 1 and 25),
  message        text check (char_length(message) <= 200),
  status         text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  lobby_id       uuid references public.lobbies (id) on delete set null,
  created_at     timestamptz not null default now(),
  decided_at     timestamptz,
  constraint crew_challenges_different check (from_crew_id <> to_crew_id)
);

create unique index crew_challenges_one_pending on public.crew_challenges (from_crew_id, to_crew_id) where status = 'pending';
create index crew_challenges_from_idx on public.crew_challenges (from_crew_id, created_at desc);
create index crew_challenges_to_idx on public.crew_challenges (to_crew_id, created_at desc);

alter table public.crew_challenges enable row level security;
create policy "crew_challenges: участники и принятые" on public.crew_challenges
  for select to authenticated using (
    status = 'accepted'
    or public.is_crew_member(from_crew_id, auth.uid())
    or public.is_crew_member(to_crew_id, auth.uid())
  );

-- Матч команд — обычная игра (карта, чат, QR), но вступают в неё только игроки этих двух команд
alter table public.lobbies
  add column crew_challenge_id uuid unique references public.crew_challenges (id) on delete set null;

create or replace function public.guard_crew_match_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'pending' and exists (
    select 1 from public.lobbies l where l.id = new.lobby_id and l.crew_challenge_id is not null
  ) then
    raise exception 'crew_match_only' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger applications_crew_match_guard
  before insert or update of status on public.lobby_applications
  for each row execute function public.guard_crew_match_application();

create or replace function public.create_crew_challenge(
  p_from_crew uuid, p_to_crew uuid, p_start timestamptz, p_location text, p_team_size smallint, p_message text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from public.crews;
  v_to public.crews;
  v_id uuid;
begin
  select * into v_from from public.crews where id = p_from_crew;
  select * into v_to from public.crews where id = p_to_crew;
  if v_from.id is null or v_to.id is null then raise exception 'crew_not_found' using errcode = 'P0001'; end if;
  if v_from.captain_id is distinct from auth.uid() then raise exception 'not_captain' using errcode = 'P0001'; end if;
  if v_from.id = v_to.id or v_from.captain_id = v_to.captain_id then raise exception 'same_crew' using errcode = 'P0001'; end if;
  if public.is_blocked_between(v_from.captain_id, v_to.captain_id) then raise exception 'user_blocked' using errcode = 'P0001'; end if;
  if p_start < now() + interval '1 hour' or p_start > now() + interval '60 days' then
    raise exception 'bad_challenge_time' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.crew_challenges where from_crew_id = v_from.id and to_crew_id = v_to.id and status = 'pending') then
    raise exception 'challenge_exists' using errcode = 'P0001';
  end if;

  insert into public.crew_challenges (from_crew_id, to_crew_id, created_by, sport, start_time, city_id, location_name, team_size, message)
  values (v_from.id, v_to.id, auth.uid(), v_from.sport, p_start, v_from.city_id, btrim(p_location), p_team_size,
          nullif(btrim(coalesce(p_message, '')), ''))
  returning id into v_id;

  perform public.notify(v_to.captain_id, 'crew_challenge', jsonb_build_object(
    'crew_id', v_to.id, 'crew_name', v_from.name, 'sport', v_from.sport, 'start_time', p_start, 'location', btrim(p_location)
  ));
  return v_id;
end;
$$;

create or replace function public.respond_crew_challenge(p_challenge_id uuid, p_accept boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ch public.crew_challenges;
  v_from public.crews;
  v_to public.crews;
  v_lobby uuid;
  v_member uuid;
begin
  select * into v_ch from public.crew_challenges where id = p_challenge_id for update;
  if not found then raise exception 'challenge_not_found' using errcode = 'P0001'; end if;
  select * into v_from from public.crews where id = v_ch.from_crew_id;
  select * into v_to from public.crews where id = v_ch.to_crew_id;
  if v_to.captain_id is distinct from v_uid then raise exception 'not_captain' using errcode = 'P0001'; end if;
  if v_ch.status <> 'pending' then raise exception 'already_decided' using errcode = 'P0001'; end if;

  if not p_accept then
    update public.crew_challenges set status = 'declined', decided_at = now() where id = v_ch.id;
    perform public.notify(v_from.captain_id, 'crew_challenge_declined', jsonb_build_object(
      'crew_id', v_from.id, 'crew_name', v_to.name, 'sport', v_ch.sport, 'start_time', v_ch.start_time));
    return null;
  end if;

  if v_ch.start_time <= now() then raise exception 'lobby_started' using errcode = 'P0001'; end if;
  if public.is_blocked_between(v_from.captain_id, v_to.captain_id) then raise exception 'user_blocked' using errcode = 'P0001'; end if;

  perform set_config('app.bypass_counters', 'on', true);
  insert into public.lobbies (organizer_id, sport, description, players_current, players_needed, accepted_count,
                              start_time, duration_min, city_id, location_name, crew_challenge_id)
  values (v_from.captain_id, v_ch.sport, left(v_from.name || ' против ' || v_to.name, 300), 1,
          greatest(v_ch.team_size * 2 - 1, 1), 1, v_ch.start_time, v_ch.duration_min, v_ch.city_id, v_ch.location_name, v_ch.id)
  returning id into v_lobby;
  perform set_config('app.silent_applications', 'on', true);
  insert into public.lobby_applications (lobby_id, user_id, status, decided_at) values (v_lobby, v_uid, 'accepted', now());
  perform set_config('app.silent_applications', 'off', true);
  update public.lobbies
     set status = case when accepted_count >= players_needed then 'full'::public.lobby_status else 'active'::public.lobby_status end
   where id = v_lobby;
  perform set_config('app.bypass_counters', 'off', true);

  update public.crew_challenges set status = 'accepted', decided_at = now(), lobby_id = v_lobby where id = v_ch.id;

  for v_member in
    select distinct m.user_id from public.crew_members m
     where m.crew_id in (v_from.id, v_to.id) and m.status = 'active' and m.user_id <> v_uid
  loop
    perform public.notify(v_member, 'crew_match', jsonb_build_object(
      'lobby_id', v_lobby, 'crew_name', v_from.name || ' — ' || v_to.name, 'sport', v_ch.sport,
      'start_time', v_ch.start_time, 'location', v_ch.location_name));
  end loop;
  return v_lobby;
end;
$$;

create or replace function public.cancel_crew_challenge(p_challenge_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.crew_challenges ch
     set status = 'cancelled', decided_at = now()
    from public.crews c
   where ch.id = p_challenge_id and c.id = ch.from_crew_id and c.captain_id = auth.uid() and ch.status = 'pending';
  if not found then raise exception 'not_captain' using errcode = 'P0001'; end if;
end;
$$;

-- Игрок одной из двух команд сам подтверждает участие в матче
create or replace function public.join_crew_match(p_lobby_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_lobby public.lobbies;
  v_ch public.crew_challenges;
  v_status public.application_status;
begin
  select * into v_lobby from public.lobbies where id = p_lobby_id for update;
  if not found or v_lobby.crew_challenge_id is null then raise exception 'lobby_not_found' using errcode = 'P0001'; end if;
  select * into v_ch from public.crew_challenges where id = v_lobby.crew_challenge_id;
  if not (public.is_crew_member(v_ch.from_crew_id, v_uid) or public.is_crew_member(v_ch.to_crew_id, v_uid)) then
    raise exception 'crew_match_only' using errcode = 'P0001';
  end if;
  if v_lobby.organizer_id = v_uid then return; end if;
  if v_lobby.status = 'cancelled' then raise exception 'lobby_cancelled' using errcode = 'P0001'; end if;
  if v_lobby.status = 'finished' or v_lobby.start_time <= now() then raise exception 'lobby_started' using errcode = 'P0001'; end if;

  select status into v_status from public.lobby_applications where lobby_id = p_lobby_id and user_id = v_uid;
  if v_status = 'accepted' then return; end if;
  if v_status = 'rejected' then raise exception 'was_rejected' using errcode = 'P0001'; end if;
  if v_lobby.accepted_count >= v_lobby.players_needed then raise exception 'lobby_full' using errcode = 'P0001'; end if;

  perform set_config('app.silent_applications', 'on', true);
  insert into public.lobby_applications (lobby_id, user_id, status, decided_at)
  values (p_lobby_id, v_uid, 'accepted', now())
  on conflict (lobby_id, user_id) do update set status = 'accepted', decided_at = now(), updated_at = now();
  perform set_config('app.silent_applications', 'off', true);

  perform set_config('app.bypass_counters', 'on', true);
  update public.lobbies
     set accepted_count = accepted_count + 1,
         status = case when accepted_count + 1 >= players_needed then 'full'::public.lobby_status else 'active'::public.lobby_status end
   where id = p_lobby_id;
  perform set_config('app.bypass_counters', 'off', true);
end;
$$;

-- Организатор не может вручную привязать игру к вызову или отвязать её и открыть матч для всех
create or replace function public.guard_lobby_write()
returns trigger
language plpgsql
as $$
declare
  bypass boolean := coalesce(current_setting('app.bypass_counters', true), '') = 'on';
begin
  new.updated_at := now();
  if bypass or auth.role() is distinct from 'authenticated' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.accepted_count := 0;
    new.status := 'active';
    new.crew_challenge_id := null;
    return new;
  end if;

  if old.status not in ('active', 'full') or old.start_time <= now() then
    raise exception 'lobby_locked' using errcode = 'P0001';
  end if;
  if new.start_time <= now() then
    raise exception 'start_in_past' using errcode = 'P0001';
  end if;
  if new.players_needed < old.accepted_count then
    raise exception 'needed_below_accepted' using errcode = 'P0001';
  end if;
  if old.accepted_count > 0 and new.start_time < old.start_time
     and new.start_time < now() + interval '30 minutes' then
    raise exception 'too_soon_with_players' using errcode = 'P0001';
  end if;

  new.organizer_id := old.organizer_id;
  new.accepted_count := old.accepted_count;
  new.crew_challenge_id := old.crew_challenge_id;
  new.status := case when new.players_needed <= old.accepted_count then 'full' else 'active' end;
  return new;
end;
$$;

-- Матчи команд не показываются среди открытых игр в конце ленты
create or replace function public.get_feed_game_ids(p_limit integer default 3)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select l.id
    from public.lobbies l
    join public.profiles me on me.id = auth.uid()
   where l.city_id = me.city_id
     and l.status = 'active'
     and l.crew_challenge_id is null
     and l.start_time > now()
     and l.start_time < now() + interval '7 days'
     and l.organizer_id <> me.id
     and not public.is_blocked_between(me.id, l.organizer_id)
     and not exists (select 1 from public.lobby_applications a where a.lobby_id = l.id and a.user_id = me.id)
   order by (l.sport = any (me.sports)) desc, l.start_time
   limit least(greatest(coalesce(p_limit, 3), 1), 10);
$$;

-- ═════════════ Права ═════════════

revoke all on function public.hand_over_crew(uuid, uuid) from public, anon, authenticated;
revoke all on function public.can_message(uuid, uuid) from public, anon, authenticated;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.start_direct_chat(uuid)',
    'public.mark_conversation_read(uuid)',
    'public.get_my_conversations()',
    'public.unread_chat_count()',
    'public.create_crew(text, text, text, smallint, boolean)',
    'public.join_crew(uuid)',
    'public.leave_crew(uuid)',
    'public.decide_crew_member(uuid, uuid, boolean)',
    'public.remove_crew_member(uuid, uuid)',
    'public.create_crew_challenge(uuid, uuid, timestamptz, text, smallint, text)',
    'public.respond_crew_challenge(uuid, boolean)',
    'public.cancel_crew_challenge(uuid)',
    'public.join_crew_match(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;

-- Можно ли мне написать этому человеку (кнопка в профиле)
create or replace function public.can_message_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_message(auth.uid(), p_user_id);
$$;
revoke all on function public.can_message_user(uuid) from public, anon;
grant execute on function public.can_message_user(uuid) to authenticated;

-- ═════════════ Realtime ═════════════
alter publication supabase_realtime add table public.chat_messages;
