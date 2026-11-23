-- Match&Play — этап 9: QR-отметка на игре и лента, у которой есть конец
-- Запускать после 0008_safety_and_flow.sql

-- ═════════════ Отметки на игре ═════════════

create table public.lobby_checkins (
  lobby_id       uuid not null references public.lobbies (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  checked_in_at  timestamptz not null default now(),
  primary key (lobby_id, user_id)
);

create index lobby_checkins_user_idx on public.lobby_checkins (user_id, checked_in_at desc);

alter table public.lobby_checkins enable row level security;
create policy "checkins: читают вошедшие" on public.lobby_checkins
  for select to authenticated using (true);
-- Записи создаются только функциями ниже.

-- Секрет игры и попытки ввода кода недоступны через API
create table private.lobby_checkin_secrets (
  lobby_id  uuid primary key references public.lobbies (id) on delete cascade,
  secret    text not null default encode(sha256((gen_random_uuid()::text || gen_random_uuid()::text)::bytea), 'hex')
);
alter table private.lobby_checkin_secrets enable row level security;

create table private.checkin_attempts (
  lobby_id    uuid not null references public.lobbies (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now()
);
create index checkin_attempts_idx on private.checkin_attempts (lobby_id, user_id, created_at desc);
alter table private.checkin_attempts enable row level security;

-- Отмечаться можно за 30 минут до начала и до 30 минут после конца игры
create or replace function private.checkin_is_open(p_lobby public.lobbies)
returns boolean
language sql
stable
as $$
  select p_lobby.status in ('active', 'full', 'finished')
     and now() >= p_lobby.start_time - interval '30 minutes'
     and now() <= p_lobby.start_time + make_interval(mins => p_lobby.duration_min) + interval '30 minutes';
$$;

-- Шестизначный код, который меняется каждые 30 секунд
create or replace function private.checkin_code(p_secret text, p_bucket bigint)
returns text
language sql
immutable
as $$
  select lpad(
    ((('x' || substr(encode(sha256((p_secret || ':' || p_bucket::text)::bytea), 'hex'), 1, 8))::bit(32)::bigint) % 1000000)::text,
    6, '0'
  );
$$;

-- Организатор получает текущий код. Его собственная отметка ставится автоматически.
create or replace function public.get_checkin_code(p_lobby_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_lobby public.lobbies;
  v_secret text;
  v_bucket bigint := floor(extract(epoch from now()) / 30)::bigint;
begin
  select * into v_lobby from public.lobbies where id = p_lobby_id;
  if not found or v_lobby.organizer_id is distinct from auth.uid() then
    raise exception 'not_organizer' using errcode = 'P0001';
  end if;
  if not private.checkin_is_open(v_lobby) then
    raise exception 'checkin_closed' using errcode = 'P0001';
  end if;

  insert into private.lobby_checkin_secrets (lobby_id) values (p_lobby_id) on conflict do nothing;
  select secret into v_secret from private.lobby_checkin_secrets where lobby_id = p_lobby_id;
  insert into public.lobby_checkins (lobby_id, user_id) values (p_lobby_id, auth.uid()) on conflict do nothing;

  return jsonb_build_object(
    'code', private.checkin_code(v_secret, v_bucket),
    'expires_at', to_timestamp((v_bucket + 1) * 30),
    'count', (select count(*) from public.lobby_checkins c where c.lobby_id = p_lobby_id)
  );
end;
$$;

-- Игрок вводит или сканирует код. Возвращает статус, а не ошибку, чтобы попытка сохранилась.
create or replace function public.check_in(p_lobby_id uuid, p_code text)
returns text
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_uid uuid := auth.uid();
  v_lobby public.lobbies;
  v_secret text;
  v_bucket bigint := floor(extract(epoch from now()) / 30)::bigint;
begin
  if v_uid is null then return 'not_member'; end if;
  select * into v_lobby from public.lobbies where id = p_lobby_id;
  if not found then return 'not_member'; end if;
  if v_lobby.organizer_id <> v_uid and not exists (
    select 1 from public.lobby_applications a
     where a.lobby_id = p_lobby_id and a.user_id = v_uid and a.status = 'accepted'
  ) then
    return 'not_member';
  end if;
  if exists (select 1 from public.lobby_checkins c where c.lobby_id = p_lobby_id and c.user_id = v_uid) then
    return 'already';
  end if;
  if not private.checkin_is_open(v_lobby) then return 'closed'; end if;

  delete from private.checkin_attempts where created_at < now() - interval '1 hour';
  if (select count(*) from private.checkin_attempts a
       where a.lobby_id = p_lobby_id and a.user_id = v_uid and a.created_at > now() - interval '1 minute') >= 5 then
    return 'too_many';
  end if;
  insert into private.checkin_attempts (lobby_id, user_id) values (p_lobby_id, v_uid);

  select secret into v_secret from private.lobby_checkin_secrets where lobby_id = p_lobby_id;
  -- Принимаем и предыдущий код: он мог смениться, пока игрок наводил камеру
  if v_secret is null or coalesce(p_code, '') not in (
    private.checkin_code(v_secret, v_bucket),
    private.checkin_code(v_secret, v_bucket - 1)
  ) then
    return 'bad_code';
  end if;

  insert into public.lobby_checkins (lobby_id, user_id) values (p_lobby_id, v_uid) on conflict do nothing;
  return 'ok';
end;
$$;

-- Подтверждённая игра: отметились минимум двое, поэтому в одиночку счётчик не накрутить
create or replace function public.verified_games_count(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
    from public.lobby_checkins mine
   where mine.user_id = p_user_id
     and (select count(*) from public.lobby_checkins c where c.lobby_id = mine.lobby_id) >= 2;
$$;

-- ═════════════ Лента ═════════════

-- С кем я реально играл. Если на игре отмечались, считаются только отметившиеся;
-- для игр без отметок (в том числе старых) — состав игры.
create or replace function public.get_played_with_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  with my_games as (
    select l.id, l.organizer_id
      from public.lobbies l
     where l.status = 'finished'
       and (l.organizer_id = auth.uid()
            or exists (select 1 from public.lobby_applications a
                        where a.lobby_id = l.id and a.user_id = auth.uid() and a.status = 'accepted'))
  ),
  roster as (
    select g.id as lobby_id, g.organizer_id as user_id from my_games g
    union
    select a.lobby_id, a.user_id
      from public.lobby_applications a
      join my_games g on g.id = a.lobby_id
     where a.status = 'accepted'
  )
  select distinct r.user_id
    from roster r
   where r.user_id <> auth.uid()
     and not public.is_blocked_between(auth.uid(), r.user_id)
     and (
       (select count(*) from public.lobby_checkins c where c.lobby_id = r.lobby_id) < 2
       or (
         exists (select 1 from public.lobby_checkins c where c.lobby_id = r.lobby_id and c.user_id = auth.uid())
         and exists (select 1 from public.lobby_checkins c where c.lobby_id = r.lobby_id and c.user_id = r.user_id)
       )
     );
$$;

-- Открытые игры в моём городе на ближайшую неделю: сначала мои виды спорта, затем ближайшие по времени
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
     and l.start_time > now()
     and l.start_time < now() + interval '7 days'
     and l.organizer_id <> me.id
     and not public.is_blocked_between(me.id, l.organizer_id)
     and not exists (select 1 from public.lobby_applications a where a.lobby_id = l.id and a.user_id = me.id)
   order by (l.sport = any (me.sports)) desc, l.start_time
   limit least(greatest(coalesce(p_limit, 3), 1), 10);
$$;

revoke all on function public.get_checkin_code(uuid) from public, anon;
revoke all on function public.check_in(uuid, text) from public, anon;
revoke all on function public.get_played_with_ids() from public, anon;
revoke all on function public.get_feed_game_ids(integer) from public, anon;
grant execute on function public.get_checkin_code(uuid) to authenticated;
grant execute on function public.check_in(uuid, text) to authenticated;
grant execute on function public.get_played_with_ids() to authenticated;
grant execute on function public.get_feed_game_ids(integer) to authenticated;
